export declare class UIManager {
    private static uiHidden;
    static setUserInterfaceVisible(value: boolean): void;
    static setLoadingScreenVisible(value: boolean): void;
    static setFPSVisible(value: boolean): void;
    /**
     * Hide/show every overlay UI element (controls panel, settings GUI,
     * FPS stats, console messages) for a clean view. The toggle button
     * hides itself as well so footage is completely clean; the H hotkey
     * always brings the UI back.
     */
    static toggleAllUI(): void;
    static setAllUIVisible(value: boolean): void;
}
