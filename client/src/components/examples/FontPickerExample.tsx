import { useState } from 'react';
import { FontPicker } from '../theme-customizer/FontPicker';

export default function FontPickerExample() {
  const [font, setFont] = useState('Inter');

  return (
    <div className="p-4 max-w-md">
      <FontPicker
        value={font}
        defaultValue="Inter"
        onChange={setFont}
        label="--font-family-sans"
        description="Sans-serif font family"
      />
    </div>
  );
}
