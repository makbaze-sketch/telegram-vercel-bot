import bot from "../bot.js";

export default async function handler(req, res) {
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error("Ошибка обработки webhook:", err);
  }
  res.status(200).json({ ok: true });
}
