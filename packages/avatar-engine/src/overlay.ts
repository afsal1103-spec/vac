export type OverlayState = {
  isInteractive: boolean;
  isSpeaking: boolean;
  position: { x: number; y: number };
};

export function nextOverlayState(previous: OverlayState, isSpeaking: boolean): OverlayState {
  if (isSpeaking) {
    return {
      ...previous,
      isSpeaking: true,
      isInteractive: true
    };
  }

  return {
    ...previous,
    isSpeaking: false,
    isInteractive: false
  };
}
