/** Text for controller actions, disputes and appeals. Amharic is a draft for a fluent speaker to check. */
import type { ControllerActionType } from "@taxiflow/shared";

type Text = { title: string; body: string };
const am = (language: string) => language === "am";

const ACTION_EN: Record<ControllerActionType, string> = {
  WARN: "You received a warning from the queue controller.",
  MOVE_BACK: "The queue controller moved you back in the line.",
  MOVE_FORWARD: "The queue controller moved you forward in the line.",
  CONFIRM_PRIORITY: "The queue controller confirmed your priority.",
  REJECT_PRIORITY: "The queue controller removed your priority.",
  MARK_NO_SHOW: "The queue controller marked you as not boarded.",
  REMOVE: "The queue controller removed you from the line.",
  SUSPEND: "The queue controller suspended you from the queues.",
  ALLOW_OUT_OF_TURN: "The queue controller let you start out of turn.",
  REORDER_DRIVER: "The queue controller changed your place in the driver line.",
  RESOLVE_DISPUTE: "Your dispute was resolved.",
  APPEAL_REVERSED: "An administrator reversed the decision.",
};

const ACTION_AM: Record<ControllerActionType, string> = {
  WARN: "ከወረፋ ተቆጣጣሪው ማስጠንቀቂያ ደርሶዎታል።",
  MOVE_BACK: "የወረፋ ተቆጣጣሪው ወደ ኋላ አንቀሳቅሶዎታል።",
  MOVE_FORWARD: "የወረፋ ተቆጣጣሪው ወደ ፊት አንቀሳቅሶዎታል።",
  CONFIRM_PRIORITY: "የወረፋ ተቆጣጣሪው ቅድሚያዎን አረጋግጧል።",
  REJECT_PRIORITY: "የወረፋ ተቆጣጣሪው ቅድሚያዎን አስወግዷል።",
  MARK_NO_SHOW: "የወረፋ ተቆጣጣሪው አልተሳፈሩም ብሎ ምልክት አድርጓል።",
  REMOVE: "የወረፋ ተቆጣጣሪው ከወረፋ አውጥቶዎታል።",
  SUSPEND: "የወረፋ ተቆጣጣሪው ከወረፋዎች አግዶዎታል።",
  ALLOW_OUT_OF_TURN: "የወረፋ ተቆጣጣሪው ከተራ ውጪ እንዲጀምሩ ፈቅዷል።",
  REORDER_DRIVER: "የወረፋ ተቆጣጣሪው በአሽከርካሪ ወረፋ ቦታዎን ቀይሯል።",
  RESOLVE_DISPUTE: "አቤቱታዎ ተፈትቷል።",
  APPEAL_REVERSED: "አስተዳዳሪው ውሳኔውን ቀልብሷል።",
};

export function actionText(language: string, action: ControllerActionType, reason: string): Text {
  const body = am(language) ? ACTION_AM[action] : ACTION_EN[action];
  return am(language)
    ? { title: "የወረፋ ውሳኔ", body: `${body} ምክንያት፦ ${reason}` }
    : { title: "Queue decision", body: `${body} Reason: ${reason}` };
}

export function disputeOpenedText(language: string): Text {
  return am(language)
    ? { title: "አቤቱታ ቀርቧል", body: "አቤቱታዎ ደርሷል። ተቆጣጣሪው ይመለከተዋል።" }
    : { title: "Dispute received", body: "Your dispute was received. The queue controller will look at it." };
}

export function disputeInReviewText(language: string): Text {
  return am(language)
    ? { title: "አቤቱታ በመታየት ላይ", body: "ተቆጣጣሪው አቤቱታዎን እየተመለከተ ነው።" }
    : { title: "Dispute in review", body: "The queue controller is looking at your dispute." };
}

export function disputeResolvedText(language: string, note: string): Text {
  return am(language)
    ? { title: "አቤቱታ ተፈትቷል", body: `ውሳኔ፦ ${note}` }
    : { title: "Dispute resolved", body: `Decision: ${note}` };
}

export function appealDecidedText(language: string, status: "UPHELD" | "REVERSED", note: string): Text {
  if (am(language)) {
    return status === "REVERSED"
      ? { title: "ይግባኝዎ ተቀባይነት አግኝቷል", body: `ውሳኔው ተቀልብሷል። ${note}` }
      : { title: "ይግባኝዎ ተቀባይነት አላገኘም", body: `ውሳኔው ጸንቷል። ${note}` };
  }
  return status === "REVERSED"
    ? { title: "Appeal accepted", body: `The decision was reversed. ${note}` }
    : { title: "Appeal decided", body: `The decision stands. ${note}` };
}

export function pickupText(language: string, kind: "accepted" | "arrived" | "completed" | "cancelled" | "expired", plate?: string): Text {
  const en = {
    accepted: { title: "Taxi on the way", body: `Taxi ${plate ?? ""} accepted your pickup request.` },
    arrived: { title: "Your taxi arrived", body: `Taxi ${plate ?? ""} is at your pickup spot.` },
    completed: { title: "Pickup finished", body: "Your pickup is complete. Your location was cleared." },
    cancelled: { title: "Pickup cancelled", body: "Your pickup request was cancelled. Your location was cleared." },
    expired: { title: "No taxi found", body: "Nobody accepted your pickup request in time. Your location was cleared." },
  } as const;
  const amharic = {
    accepted: { title: "ታክሲ በመንገድ ላይ ነው", body: `ታክሲ ${plate ?? ""} ጥያቄዎን ተቀብሏል።` },
    arrived: { title: "ታክሲዎ ደርሷል", body: `ታክሲ ${plate ?? ""} ባሉበት ደርሷል።` },
    completed: { title: "ጉዞ ተጠናቋል", body: "ጥያቄዎ ተጠናቋል። ያሉበት ቦታ ተሰርዟል።" },
    cancelled: { title: "ጥያቄ ተሰርዟል", body: "የመነሻ ጥያቄዎ ተሰርዟል። ያሉበት ቦታ ተሰርዟል።" },
    expired: { title: "ታክሲ አልተገኘም", body: "በጊዜው ማንም አልተቀበለም። ያሉበት ቦታ ተሰርዟል።" },
  } as const;
  return am(language) ? amharic[kind] : en[kind];
}
