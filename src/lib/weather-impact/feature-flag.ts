export function isWeatherImpactEnabled(isOwner: boolean) {
  return (
    isOwner ||
    process.env.NEXT_PUBLIC_T2Q_WEATHER_IMPACT === "1" ||
    process.env.T2Q_WEATHER_IMPACT === "1"
  );
}
