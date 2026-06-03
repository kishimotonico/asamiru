import { useAtom } from "jotai";
import { weatherSettingsAtom } from "./weatherSettingsAtom";
import { SettingField, TextInput } from "./components/FormControls";

export function WeatherSettingsSection() {
  const [weather, setWeather] = useAtom(weatherSettingsAtom);

  return (
    <div className="space-y-4">
      <SettingField label="地名（表示用）">
        <TextInput
          type="text"
          value={weather.locationName}
          onChange={(e) => setWeather((prev) => ({ ...prev, locationName: e.target.value }))}
          className="w-full"
        />
      </SettingField>
      <SettingField label="緯度">
        <TextInput
          type="number"
          step="0.0001"
          value={weather.lat}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lat: v }));
          }}
          className="w-full"
        />
      </SettingField>
      <SettingField label="経度">
        <TextInput
          type="number"
          step="0.0001"
          value={weather.lon}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lon: v }));
          }}
          className="w-full"
        />
      </SettingField>
    </div>
  );
}
