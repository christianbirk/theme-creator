import { useState } from 'react';
import { StringInput } from '../theme-customizer/StringInput';

export default function StringInputExample() {
  const [value, setValue] = useState('ease-in-out');

  return (
    <div className="p-4 max-w-md">
      <StringInput
        value={value}
        defaultValue="ease-in-out"
        onChange={setValue}
        label="--easing-default"
        description="Default easing function"
      />
    </div>
  );
}
