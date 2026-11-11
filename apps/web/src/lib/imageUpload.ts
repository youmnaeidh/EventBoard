import { api } from './api';

/** The server decodes, bounds dimensions and strips metadata before storage. */
export async function uploadEventImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('اختر صورة JPEG أو PNG أو WebP');
  if (file.size > 10 * 1024 * 1024) throw new Error('الحد الأقصى للصورة 10 ميجابايت');
  return (await api.upload(file)).imageUrl;
}
