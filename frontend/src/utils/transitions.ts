/**
 * transitions (v6.30) — ONE answer to "which transitions sit LEFT?"
 *
 * Derek (with the reference page): "The actual transition is always aligned
 * right in the program. make 'FADE IN:' aligned left." That matches the
 * industry rule: FADE IN: is the opening transition and sits at the LEFT
 * margin; every other transition (CUT TO:, FADE OUT., DISSOLVE TO:…) sits
 * right. Read by the editor's Transition decoration AND the PDF exporter —
 * one predicate, so screen and paper can't disagree.
 */
export const isLeftTransition = (text: string): boolean =>
  /^FADE IN\s*[:.]?\s*$/i.test(text.trim());
