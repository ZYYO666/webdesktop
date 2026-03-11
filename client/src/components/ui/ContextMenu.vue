<template>
  <n-config-provider :theme-overrides="menuThemeOverrides">
    <n-dropdown
      :show="menuState.visible"
      :options="menuOptions"
      :x="menuState.position.left"
      :y="menuState.position.top"
      placement="bottom-start"
      trigger="manual"
      :menu-props="getDropdownMenuProps"
      :on-clickoutside="handleClickOutside"
      @select="handleSelect"
      class="select-none"
    />
  </n-config-provider>
</template>

<script setup>
import { computed, h } from 'vue';
import { NConfigProvider, NIcon } from 'naive-ui';
import { useOs } from '@/os';
import {
  Archive,
  Copy as CopyIcon,
  Edit2,
  Eye,
  EyeOff,
  ExternalLink,
  Folder,
  FolderOpen,
  Info,
  Link2,
  MoreHorizontal,
  UploadCloud,
  RefreshCw,
  RotateCcw,
  Scissors,
  Settings,
  Star,
  Trash2
} from 'lucide-vue-next';

const menuThemeOverrides = {
  Dropdown: {
    color: 'rgba(245, 245, 245, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    optionColorHover: '#007AFF',
    optionTextColorHover: '#FFFFFF',
    optionIconColorHover: '#FFFFFF',
    optionTextColor: '#333333',
    optionIconColor: '#333333',
    prefixColor: '#333333',
    suffixColor: '#333333',
    prefixColorHover: '#FFFFFF',
    suffixColorHover: '#FFFFFF',
    borderRadius: '10px',
    padding: '5px',
    optionBorderRadius: '6px',
    dividerColor: 'rgba(0, 0, 0, 0.1)'
  },
  Popover: {
    color: 'rgba(245, 245, 245, 0.65)',
    borderRadius: '10px',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1)'
  }
};

const getDropdownMenuProps = () => {
  return {
    style: {
      width: '160px',
      backgroundColor: 'rgba(245, 245, 245, 0.65)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      padding: '5px'
    }
  };
};

const os = useOs();
const menuState = os.ui.contextMenu.state;

const unwrap = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

const iconMap = {
  archive: Archive,
  copy: CopyIcon,
  edit2: Edit2,
  eye: Eye,
  eyeOff: EyeOff,
  externalLink: ExternalLink,
  folder: Folder,
  folderOpen: FolderOpen,
  info: Info,
  link2: Link2,
  moreHorizontal: MoreHorizontal,
  uploadCloud: UploadCloud,
  refreshCw: RefreshCw,
  rotateCcw: RotateCcw,
  scissors: Scissors,
  settings: Settings,
  star: Star,
  trash2: Trash2
};

const renderIcon = (icon) => {
  return () => h(NIcon, null, { default: () => h(icon, { size: 16 }) });
};

const mapOption = (option) => {
  if (!option || typeof option !== 'object') return option;

  const {
    iconKey,
    danger,
    textColor,
    children,
    props,
    ...rest
  } = option;

  const next = { ...rest };

  if (iconKey && iconMap[iconKey]) {
    next.icon = renderIcon(iconMap[iconKey]);
  } else if ('icon' in option) {
    next.icon = option.icon;
  }

  if (children) {
    next.children = Array.isArray(children) ? children.map(mapOption) : children;
  }

  const style = {
    ...(props && props.style ? props.style : null),
    ...(danger ? { color: 'var(--n-error-color)' } : null),
    ...(textColor ? { color: textColor } : null)
  };

  if ((props && props.style) || danger || textColor) {
    next.props = { ...(props || null), style };
  } else if (props) {
    next.props = props;
  }

  return next;
};

const menuOptions = computed(() => {
  if (!menuState.visible) return [];
  const ctx = menuState.context || {};
  const rawOptions = unwrap(ctx.options);
  const raw = Array.isArray(rawOptions) ? rawOptions : [];
  return Array.isArray(raw) ? raw.map(mapOption) : [];
});

const handleSelect = (key) => {
  os.ui.contextMenu.select(key);
};

const handleClickOutside = () => {
  os.ui.contextMenu.close();
};
</script>
