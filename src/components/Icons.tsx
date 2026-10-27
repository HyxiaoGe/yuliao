import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = { color?: string; size?: number };
const DEFAULT = '#1A1A1A';

/** 三横线：打开历史对话抽屉 */
export const MenuIcon = ({ color = DEFAULT, size = 26 }: Props) => <Ionicons name="menu-outline" size={size} color={color} />;
/** 新对话 */
export const NewChatIcon = ({ color = DEFAULT, size = 24 }: Props) => <Ionicons name="create-outline" size={size} color={color} />;
/** 自动朗读开 / 关 */
export const SpeakerOnIcon = ({ color = DEFAULT, size = 24 }: Props) => <Ionicons name="volume-high-outline" size={size} color={color} />;
export const SpeakerOffIcon = ({ color = DEFAULT, size = 24 }: Props) => <Ionicons name="volume-mute-outline" size={size} color={color} />;
/** 输入区：切到键盘 / 切到语音 */
export const KeyboardIcon = ({ color = DEFAULT, size = 24 }: Props) => <MaterialCommunityIcons name="keyboard-outline" size={size} color={color} />;
export const MicIcon = ({ color = DEFAULT, size = 24 }: Props) => <MaterialCommunityIcons name="microphone-outline" size={size} color={color} />;
/** 发送 / 停止 */
export const SendIcon = ({ color = '#FFFFFF', size = 20 }: Props) => <Ionicons name="arrow-up" size={size} color={color} />;
export const StopIcon = ({ color = '#FFFFFF', size = 16 }: Props) => <Ionicons name="stop" size={size} color={color} />;
