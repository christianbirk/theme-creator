import { useState } from 'react';
import { ColorPicker } from '../theme-customizer/ColorPicker';

export default function ColorPickerExample() {
  const [color, setColor] = useState('#3B82F6');

  return (
    <div className="p-4 max-w-md">
      <ColorPicker
        value={color}
        defaultValue="#3B82F6"
        onChange={setColor}
        label="--primary"
        description="Primary brand color"
      />
    </div>
  );
}
