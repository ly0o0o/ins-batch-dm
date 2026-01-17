/**
 * 任务配置接口
 */
export interface TaskConfig {
  links: string[];
  message: string;
  delayMin: number;
  delayMax: number;
}

/**
 * 任务结果接口
 */
export interface TaskResult {
  link: string;
  success: boolean;
  error?: string;
}

/**
 * 任务状态接口
 */
export interface TaskState {
  links: string[];
  message: string;
  delayMin: number;
  delayMax: number;
  currentIndex: number;
  results: TaskResult[];
}

/**
 * 消息类型
 */
export type MessageType =
  | 'START_TASK'
  | 'STOP_TASK'
  | 'EXECUTE_DM'
  | 'DM_RESULT'
  | 'LOG'
  | 'PROGRESS'
  | 'TASK_COMPLETE';

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * 消息接口
 */
export interface Message {
  type: MessageType;
  [key: string]: any;
}
