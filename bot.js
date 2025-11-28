import { Telegraf, Markup } from "telegraf";

export const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMINS = [-1003371815477];  // ID канала или юзера
const PRICE = 300;

bot.start((ctx) => {
  ctx.reply(
    "✨ Добро пожаловать!\n\n" +
      "Товар: *Все Локации*\n" +
      "Цена: *300⭐*\n\n" +
      "Нажмите кнопку ниже, чтобы купить.",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Купить за 300⭐", "BUY")],
      ]),
    }
  );
});

bot.action("BUY", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.replyWithInvoice({
    title: "Все Локации",
    description: "Игровой актив",
    payload: "all_locations_001",
    provider_token: "",
    currency: "XTR",
    prices: [{ label: "Все Локации", amount: PRICE }],
  });
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment", async (ctx) => {
  const u = ctx.message.from;

  const msg =
    "📩 *Новый заказ!*\n" +
    `Покупатель: @${u.username}\n` +
    `ID: ${u.id}\n` +
    "Товар: Все Локации\n" +
    `Оплата: ${PRICE}⭐`;

  for (const admin of ADMINS) {
    await ctx.telegram.sendMessage(admin, msg, { parse_mode: "Markdown" });
  }

  await ctx.reply("🔔 Оплата получена!\nОжидайте выдачу товара.");
