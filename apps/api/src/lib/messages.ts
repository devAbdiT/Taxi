/** Passenger-facing text. Amharic is a draft for a fluent speaker to check. */

const stationName = (language: string, name: string, nameAm: string | null) =>
  language === "am" && nameAm ? nameAm : name;

export function calledText(language: string, plate: string, station: string, stationAm: string | null) {
  const place = stationName(language, station, stationAm);
  if (language === "am") {
    return { title: "ታክሲ ዝግጁ ነው", body: `ታክሲ ${plate} በ${place} ዝግጁ ነው። አሁን ይሳፈሩ።` };
  }
  return { title: "Taxi ready", body: `Taxi ${plate} at ${place} is ready. Board now.` };
}

export function noShowText(language: string) {
  if (language === "am") {
    return { title: "አልተገኙም", body: "አልተሳፈሩም። ቦታዎ ለሌላ ተሳፋሪ ተሰጥቷል።" };
  }
  return { title: "Missed the taxi", body: "You did not board. Your seat was given to someone else." };
}

export function returnedText(language: string) {
  if (language === "am") {
    return { title: "ወደ ወረፋ ተመልሰዋል", body: "ጉዞው ተሰርዟል። ቦታዎ ተጠብቆ ተመልሷል።" };
  }
  return { title: "Back in the queue", body: "The trip was cancelled. You kept your place." };
}

export function arrivedText(language: string) {
  if (language === "am") {
    return { title: "ደርሰዋል", body: "ጉዞው ተጠናቋል። እባክዎ ደረጃ ይስጡ።" };
  }
  return { title: "You have arrived", body: "Your trip is complete. Please rate it." };
}
