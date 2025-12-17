import { useState } from 'react';
import { SizeInput } from '../theme-customizer/SizeInput';

export default function SizeInputExample() {
  const [size, setSize] = useState('16px');

  return (
    <div className="p-4 max-w-md">
      <SizeInput
        value={size}
        defaultValue="16px"
        onChange={setSize}
        label="--font-size-base"
        description="Base font size"
      />
    </div>
  );
}
