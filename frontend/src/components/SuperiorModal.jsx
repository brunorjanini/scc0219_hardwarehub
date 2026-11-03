import { X } from "lucide-react";
import "./SuperiorModal.css";
import { motion, useReducedMotion } from "motion/react";

// Toast-style modal: shows a message and a close button
// `type` selects the style: "error" or anything else (success)
export default function SuperiorModal({ children, onClose, type }) {
  // System setting "reduce motion": appear and disappear without sliding
  const reduceMotion = useReducedMotion();

  return (
    // Slides in from the right and fades; `exit` runs when AnimatePresence unmounts it
    <motion.div
      className={type === "error" ? "error-div" : "sucess-div"}
      initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
    >
      {/* Message text passed by the parent */}
      <p>{children}</p>

      {/* Close button; the parent clears the message in `onClose` */}
      <div className="close-button-div">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar mensagem">
          <X className="x-icon" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
