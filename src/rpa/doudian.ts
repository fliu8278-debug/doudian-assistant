export type LoginState = 'logged_in' | 'need_login' | 'unknown';

export type DoudianPageCheck = {
  url: string;
  state: LoginState;
};

