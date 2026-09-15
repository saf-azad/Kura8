export function isMac(platform: string): boolean { return /Mac|iPhone|iPad|iPod/i.test(platform); }
export function primaryModifier(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>, mac: boolean): boolean {
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
export function shortcutLabel(keys: string, mac: boolean): string {
  return keys.replace('Mod', mac ? '⌘' : 'Ctrl').replace('Shift', mac ? '⇧' : 'Shift');
}
export function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
