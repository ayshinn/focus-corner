import './styles.css';
import { bootstrapTheme, registerTheme } from './theme';
import { minimal } from './theme/themes/minimal';
import { cozyDorm } from './theme/themes/cozy-dorm';
import { library } from './theme/themes/library';
import { centralPark } from './theme/themes/central-park';
import { mountSidebar } from './sidebar';
import { mountSettingsDrawer } from './ui/settings-drawer';
import { mountSettingsControls } from './ui/settings-controls';
import { mountBackdrop } from './backdrop';
import { mountClock } from './clock';
import { mountCurrentTask } from './current-task';
import { mountPomodoro } from './pomodoro';
import { mountTodo } from './todo';

registerTheme(minimal);
registerTheme(cozyDorm);
registerTheme(library);
registerTheme(centralPark);
bootstrapTheme();

const sidebar = document.querySelector<HTMLElement>('.sidebar');
const drawer = document.querySelector<HTMLElement>('.settings-drawer');
const main = document.querySelector<HTMLElement>('.main');
const clockSlot = document.querySelector<HTMLElement>('[data-slot="clock"]');
const currentTaskSlot = document.querySelector<HTMLElement>('[data-slot="current-task"]');
const settingsSlot = document.querySelector<HTMLElement>('[data-slot="settings"]');
const pomodoroSlot = document.querySelector<HTMLElement>('[data-slot="pomodoro"]');
const todoSlot = document.querySelector<HTMLElement>('[data-slot="todo"]');
if (
  !sidebar ||
  !drawer ||
  !main ||
  !clockSlot ||
  !currentTaskSlot ||
  !settingsSlot ||
  !pomodoroSlot ||
  !todoSlot
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
mountTodo(todoSlot);
