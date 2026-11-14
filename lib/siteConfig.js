// Saytning umumiy sozlamalari va ijtimoiy tarmoq havolalari
// Xaridor ushbu qiymatlarni .env orqali yoki to'g'ridan-to'g'ri shu faylda o'zgartirishi mumkin

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'AniCity',
  telegramAdmin: process.env.NEXT_PUBLIC_TELEGRAM_ADMIN || 'anicity_admin',
  telegramChannel: process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL || 'anicity_uz',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM || 'anicity_uz',
  youtube: process.env.NEXT_PUBLIC_YOUTUBE || 'anicity_uz',

  get telegramAdminHandle() {
    return `@${this.telegramAdmin.replace(/^@/, '')}`;
  },
  get telegramChannelHandle() {
    return `@${this.telegramChannel.replace(/^@/, '')}`;
  },
  get telegramAdminUrl() {
    return `https://t.me/${this.telegramAdmin.replace(/^@/, '')}`;
  },
  get telegramChannelUrl() {
    return `https://t.me/${this.telegramChannel.replace(/^@/, '')}`;
  },
  get instagramUrl() {
    return `https://instagram.com/${this.instagram.replace(/^@/, '')}`;
  },
  get youtubeUrl() {
    return `https://youtube.com/@${this.youtube.replace(/^@/, '')}`;
  },
};
