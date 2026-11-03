import { useEffect, useRef, useState } from "react";

// State of the "delete?" dialog of the admin lists (see ConfirmDialog).
//   remove(item): async request that deletes the item
//   onDeleted(item): called after a successful deletion
//   focusRef: ref of the element that gets focus after a deletion (the
//     page <h1>, with tabIndex -1), because the row and its button are gone.
// The focus effect runs after the dialog's cleanup, which tries to restore
// the old focus. The page owns the ref: returning it from here would make
// the React Compiler lint treat the whole returned object as a ref.
export function useConfirmDelete({ remove, onDeleted, focusRef }) {
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: "" });
  const focusAfterRender = useRef(false);

  useEffect(() => {
    if (focusAfterRender.current) {
      focusAfterRender.current = false;
      focusRef.current?.focus();
    }
  });

  function open(item) {
    setStatus({ busy: false, error: "" });
    setTarget(item);
  }

  function cancel() {
    setTarget(null);
  }

  async function confirm() {
    const item = target;
    setStatus({ busy: true, error: "" });
    try {
      await remove(item);
      setTarget(null);
      setStatus({ busy: false, error: "" });
      focusAfterRender.current = true;
      onDeleted(item);
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  }

  return { target, busy: status.busy, error: status.error, open, cancel, confirm };
}
