/**
 * イベントターゲットがテキスト入力系（input/textarea/select/contentEditable）かどうか。
 * キーボードショートカットを入力中に誤発火させないためのガードに使う。
 */
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}
