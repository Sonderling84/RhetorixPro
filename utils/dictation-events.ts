
export const dispatchDictation = (transcript: string, isDictating: boolean) => {
  window.dispatchEvent(new CustomEvent('rhetorix-dictation', {
    detail: { transcript, isDictating }
  }));
};
