import './styles.css';
import { bootstrapTheme, registerTheme } from './theme';
import { minimal } from './theme/themes/minimal';
import { mountSidebar } from './sidebar';
import { mountSettingsDrawer } from './ui/settings-drawer';
import { mountSettingsControls } from './ui/settings-controls';
import { mountBackdrop } from './backdrop';
import { mountClock } from './clock';
import { mountCurrentTask } from './current-task';
import { mountPomodoro } from './pomodoro';

registerTheme(minimal);
bootstrapTheme();

const sidebar = document.querySelector<HTMLElement>('.sidebar');
const drawer = document.querySelector<HTMLElement>('.settings-drawer');
const main = document.querySelector<HTMLElement>('.main');
const clockSlot = document.querySelector<HTMLElement>('[data-slot="clock"]');
const currentTaskSlot = document.querySelector<HTMLElement>('[data-slot="current-task"]');
const settingsSlot = document.querySelector<HTMLElement>('[data-slot="settings"]');
const pomodoroSlot = document.querySelector<HTMLElement>('[data-slot="pomodoro"]');
if (
  !sidebar ||
  !drawer ||
  !main ||
  !clockSlot ||
  !currentTaskSlot ||
  !settingsSlot ||
  !pomodoroSlot
) {
  throw new Error('shell missing');
}

mountBackdrop(main);
mountSidebar(sidebar);
mountSettingsDrawer(drawer);
mountSettingsControls(settingsSlot);
mountClock(clockSlot);
mountCurrentTask(currentTaskSlot);
mountPomodoro(pomodoroSlot);
