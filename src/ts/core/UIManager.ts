export class UIManager
{
	private static uiHidden: boolean = false;

	public static setUserInterfaceVisible(value: boolean): void
	{
		const container = document.getElementById('ui-container');
		if (container !== null) container.style.display = value ? 'block' : 'none';
	}

	public static setLoadingScreenVisible(value: boolean): void
	{
		document.getElementById('loading-screen').style.display = value ? 'flex' : 'none';
	}

	public static setFPSVisible(value: boolean): void
	{
		document.getElementById('statsBox').style.display = value ? 'block' : 'none';
		document.getElementById('dat-gui-container').style.top = value ? '48px' : '0px';
	}

	/**
	 * Hide/show every overlay UI element (controls panel, settings GUI,
	 * FPS stats, console messages) for a clean view. The toggle button
	 * hides itself as well so footage is completely clean; the H hotkey
	 * always brings the UI back.
	 */
	public static toggleAllUI(): void
	{
		this.setAllUIVisible(this.uiHidden);
	}

	public static setAllUIVisible(value: boolean): void
	{
		this.uiHidden = !value;

		const ids = ['ui-container', 'dat-gui-container', 'statsBox', 'console', 'ui-toggle'];
		for (const id of ids)
		{
			const el = document.getElementById(id);
			if (el === null) continue;
			// Never un-hide the FPS stats box unless it was explicitly enabled
			if (id === 'statsBox' && value) continue;
			el.style.visibility = value ? 'visible' : 'hidden';
		}
	}
}
