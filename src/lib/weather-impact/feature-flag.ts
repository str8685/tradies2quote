export function isWeatherImpactEnabled(_isOwner: boolean) {
  return (
    process.env.NEXT_PUBLIC_T2Q_WEATHER_IMPACT !== "0" &&
    process.env.T2Q_WEATHER_IMPACT !== "0"
  );
}
