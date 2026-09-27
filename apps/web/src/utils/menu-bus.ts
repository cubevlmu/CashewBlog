/**
 * 菜单互斥总线：Menu / FABMenu 打开时广播事件，其他同总线实例收到后自动关闭，
 * 实现「同一时刻只存在一个打开的菜单」的单开互斥。
 * 每个实例持有一个递增 id；广播时携带自身 id，收到事件时排除自己。
 */
export const MENU_EXCLUSIVE_EVENT = "m3-menu-exclusive-open";

let nextInstanceId = 0;

/** 为组件实例分配一个全局唯一的互斥 id */
export function nextMenuInstanceId(): number {
	return ++nextInstanceId;
}

/** 通知其他实例关闭（打开方调用） */
export function announceMenuOpened(instanceId: number): void {
	document.dispatchEvent(
		new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { instanceId } }),
	);
}
