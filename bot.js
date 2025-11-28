// bot.js
import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.BOT_TOKEN);

// ID админов/каналов, куда падают уведомления об оплате
const ADMINS = [-1003371815477];

// Цены
const PRICE_MAIN = 300;  // все локации
const PRICE_UPDATE = 50; // новая локация после обновы

// ===== ПРОСТОЕ ХРАНИЛИЩЕ ПОКУПАТЕЛЕЙ (IN-MEMORY) =====
// ⚠ На Vercel это временно: при перезапуске/новом деплое память очищается.
// Для продакшена лучше вынести в БД/Google Sheets и т.п.
const fullAccessUsers = new Set(); // сюда кладём user_id тех, кто купил за 300⭐

function grantFullAccess(userId) {
  fullAccessUsers.add(userId);
}

function hasFullAccess(userId) {
  return fullAccessUsers.has(userId);
}

// ===== ВСПОМОГАТЕЛИ ДЛЯ ИНВОЙСОВ =====

function createInvoice({ title, description, payload, amount }) {
  return {
    title,
    description,
    payload,
    // ИСПРАВЛЕНО: ТОКЕН БЕРЕТСЯ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ VERCEL
    provider_token: process.env.PROVIDER_TOKEN,
    currency: "XTR",
    prices: [
      {
        label: title,
        amount: amount, // для XTR это количество звёзд
      },
    ],
  };
}

// ====== /start ======

bot.start(async (ctx) => {
  const user = ctx.from;
  const userId = user.id;

  const userHasFullAccess = hasFullAccess(userId);

  if (userHasFullAccess) {
    // Пользователь уже когда-то покупал полный пакет за 300⭐
    await ctx.reply(
      "У тебя уже куплен базовый пакет «Все локации» за 300⭐.\n" +
        "Теперь ты можешь:\n" +
        "• докупать новые локации по 50⭐ после выходов обновлений\n" +
        "• при желании ещё раз купить полный пакет за 300⭐.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Купить обновление за 50⭐", "BUY_50"),
          Markup.button.callback("Купить все локации за 300⭐", "BUY_300"),
        ],
      ])
    );
  } else {
    // Пользователь ещё не покупал 300⭐
    await ctx.reply(
      "Товар: Все Локации\n" +
        "Цена: 300⭐\n\n" +
        "После покупки за 300⭐ у тебя откроется возможность докупать новые локации за 50⭐ после обновлений.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Купить все локации за 300⭐", "BUY_300")],
      ])
    );
  }
});

// ====== Покупка за 300⭐ (основной пакет) ======

// Оставим совместимость со старой кнопкой "BUY", если она где-то осталась
bot.action(["BUY", "BUY_300"], async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const invoice = createInvoice({
      title: "Все Локации",
      description: "Игровой актив: полный доступ ко всем текущим локациям",
      payload: "all_locations_full_300",
      amount: PRICE_MAIN,
    });
    await ctx.replyWithInvoice(invoice);
  } catch (err) {
    console.error("Ошибка при создании инвойса 300⭐:", err);
  }
});

// ====== Покупка за 50⭐ (обновление) ======

bot.action("BUY_50", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const invoice = createInvoice({
      title: "Новая локация",
      description: "Игровой актив: доп. локация после обновления",
      payload: "location_update_50",
      amount: PRICE_UPDATE,
    });
    await ctx.replyWithInvoice(invoice);
  } catch (err) {
    console.error("Ошибка при создании инвойса 50⭐:", err);
  }
});

// ====== pre_checkout_query ======

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error("Ошибка при pre_checkout_query:", err);
  }
});

// ====== successful_payment ======

bot.on("successful_payment", async (ctx) => {
  try {
    const payment = ctx.message.successful_payment;
    const user = ctx.message.from;

    const userId = user.id;
    const username = user.username
      ? `@${user.username}`
      : `${user.first_name || ""} ${user.last_name || ""}`.trim() || "нет username";
    const amount = payment.total_amount;
    const currency = payment.currency;
    const payload = payment.invoice_payload;

    // Если оплата была за 300⭐, даём перманентный флаг full access
    if (currency === "XTR" && amount >= PRICE_MAIN) {
      grantFullAccess(userId);
    }

    // Сообщение для админов
    const isMain = amount >= PRICE_MAIN;
    const productName = isMain ? "Все локации (300⭐)" : "Обновление (50⭐)";

    const adminMsg =
      `Новый заказ\n` +
      `Покупатель: ${username}\n` +
      `ID: \`${userId}\`\n` +
      `Товар: ${productName}\n` +
      `Сумма: ${amount}⭐\n` +
      `Payload: \`${payload}\``;

    for (const adminId of ADMINS) {
      try {
        await ctx.telegram.sendMessage(adminId, adminMsg, {
          parse_mode: "Markdown",
        });
      } catch (err) {
        console.error("Не удалось отправить сообщение админу:", adminId, err);
      }
    }

    // Сообщение пользователю
    if (isMain) {
      await ctx.reply(
        "Оплата 300⭐ получена! Тебе выдан полный пакет «Все локации».\n" +
          "Теперь у тебя есть доступ докупать новые локации по 50⭐ после выходов обновлений.\n" +
          "Если что-то не выдалось — напиши в поддержку."
      );
    } else {
      await ctx.reply(
        "Оплата 50⭐ получена! Тебе выдана новая локация.\n" +
          "Если что-то не появилось в игре — напиши в поддержку."
      );
    }
  } catch (err) {
    console.error("Ошибка при обработке successful_payment:", err);
  }
});

// Экспорт бота для webhook
export default bot;
