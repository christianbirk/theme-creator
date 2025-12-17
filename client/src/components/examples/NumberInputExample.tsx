import { useState } from 'react';
import { NumberInput } from '../theme-customizer/NumberInput';

export default function NumberInputExample() {
  const [value, setValue] = useState('1.5');

  return (
    <div className="p-4 max-w-md">
      <NumberInput
        value={value}
        defaultValue="1.5"
        onChange={setValue}
        label="--line-height-normal"
        description="Normal line height"
        step={0.1}
        min={1}
        max={3}
      />
    </div>
  );
}
