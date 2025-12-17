import { PreviewPane } from '../theme-customizer/PreviewPane';
import { defaultCategories, CSSVariable } from '../theme-customizer/types';

const allVariables: CSSVariable[] = defaultCategories.flatMap(cat => cat.variables);

export default function PreviewPaneExample() {
  return (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <PreviewPane variables={allVariables} previewHtml="" />
    </div>
  );
}
