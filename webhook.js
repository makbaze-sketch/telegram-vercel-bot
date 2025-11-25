import { bot } from "../bot.js";

export default async function handler(req, res) {
  try {
    await bot.handleUpdate(req.body);
  } catch (e) {
    console.error("Ошибка обработки webhook:", e);
  }

  return res.status(200).json({ ok: true });
}
