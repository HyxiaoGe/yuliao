import { File, Paths } from 'expo-file-system';
import { uuid } from 'expo-modules-core';

const FILE_NAME = 'device-id.txt';
let cached: string | null = null;

/**
 * 设备 ID：首次启动生成一个 UUID 存在 App 沙盒的 Documents 目录，之后一直复用。
 * 服务器按它归属对话；将来做登录时把该 ID 下的对话迁移到用户名下即可。
 * 卸载重装会生成新的 ID，旧对话不再可见（服务端数据仍在）。
 */
export function getDeviceId(): string {
  if (cached) return cached;
  const file = new File(Paths.document, FILE_NAME);
  try {
    if (file.exists) {
      const id = file.textSync().trim();
      if (/^[A-Za-z0-9_-]{8,64}$/.test(id)) return (cached = id);
    }
  } catch {
    // 读失败则重新生成
  }
  const id = uuid.v4();
  try {
    file.writeSync(id);
  } catch (e) {
    console.warn('写入设备 ID 失败，本次会话使用临时 ID', e);
  }
  return (cached = id);
}
