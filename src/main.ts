import './styles.css';
import { bootstrapTheme, registerTheme } from './theme';
import { minimal } from './theme/themes/minimal';
import { mountSidebar } from './sidebar';
import { mountSettingsDrawer } from './ui/settings-drawer';
import { mountBackdrop } from './backdrop';

registerTheme(minimal);
bootstrapTheme();

const sidebar = document.querySelector<HTMLElement>('.sidebar');
const drawer = document.querySelector<HTMLElement>('.settings-drawer');
const main = document.querySelector<HTMLElement>('.main');
if (!sidebar || !drawer || !main) throw new Error('shell missing');

mountBackdrop(main);
mountSidebar(sidebar);
mountSettingsDrawer(drawer);
