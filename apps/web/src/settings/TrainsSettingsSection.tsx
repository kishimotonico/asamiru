import { useAtom } from "jotai";
import { trainsSettingsAtom, BOARDING_STATIONS } from "./trainsSettingsAtom";
import { SettingField, SelectInput, TextInput } from "./components/FormControls";

export function TrainsSettingsSection() {
  const [trains, setTrains] = useAtom(trainsSettingsAtom);

  return (
    <div className="space-y-4">
      <SettingField label="乗車駅">
        <SelectInput
          value={trains.boardingStation}
          onChange={(e) => setTrains((prev) => ({ ...prev, boardingStation: e.target.value }))}
          className="w-full"
        >
          {BOARDING_STATIONS.map((station) => (
            <option key={station} value={station}>{station}</option>
          ))}
        </SelectInput>
      </SettingField>
      <SettingField label="表示本数（方向ごと）">
        <TextInput
          type="number"
          id="displayCount"
          name="displayCount"
          min={1}
          max={10}
          value={trains.displayCount}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1) setTrains((prev) => ({ ...prev, displayCount: v }));
          }}
          className="w-full"
        />
      </SettingField>
    </div>
  );
}
