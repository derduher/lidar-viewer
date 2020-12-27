/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-onchange */
import { ChangeEventHandler, FC, useRef, useState } from "react";
import "./styles.css";
import { usePointCloud } from "./use-point-cloud";
import scenes from "./scenes.json";

const sceneLabels = scenes.map(({ name }) => ({
  label: name,
  value: name.slice(6),
}));

const App: FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const viewPortRef = useRef<HTMLDivElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [dotSize, setDotSize] = useState(0.05);
  const [sceneParam, setSceneParam] = useState("0011");
  const [dotColor, setDotColor] = useState("#80d4ff");
  const handleDotSizeChange: ChangeEventHandler<HTMLInputElement> = (e) =>
    setDotSize(parseFloat(e.target.value));
  const handleBackgroundColorChange: ChangeEventHandler<HTMLInputElement> = (
    e
  ) => setBackgroundColor(e.target.value || "#000000");
  const handleSceneParamChange: ChangeEventHandler<HTMLSelectElement> = (e) =>
    setSceneParam(e.target.value);
  const handleColorChange: ChangeEventHandler<HTMLInputElement> = (e) =>
    setDotColor(e.target.value || "#80d4ff");

  usePointCloud({
    viewPortRef,
    selectedFile,
    sceneParam,
    backgroundColor,
    blockerRef,
    instructionsRef,
    dotSize,
    color: dotColor,
  });
  return (
    <div className="App">
      <div className="primaryContent">
        <div ref={blockerRef} id="blocker">
          <div ref={instructionsRef} id="instructions">
            {!selectedFile && !sceneParam ? null : (
              <span className="cta">Click to start</span>
            )}
            <br />
            <span className="sub">Esc to uh escape?</span>
            <br />
            <br />
            Move: WASD up/down: F/V
            <br />
            Look: MOUSE
          </div>
        </div>
        <div ref={viewPortRef} id="viewPort" />
      </div>
      <div className="controls">
        <div>
          <label htmlFor="pcd">Select a file</label>
          <input
            id="pcd"
            type="file"
            name="pcd"
            onChange={(e): void =>
              setSelectedFile(e.target.files && e.target.files[0])
            }
          />
        </div>
        <div>
          <label htmlFor="dotSizeInput">Dot Size</label>
          <input
            id="dotSizeInput"
            type="range"
            step="0.01"
            min="0"
            max="1"
            value={dotSize}
            onChange={handleDotSizeChange}
          />{" "}
          {dotSize}
        </div>
        <div>
          <label htmlFor="SceneParamInput">
            SceneParam
            <select
              id="SceneParamInput"
              value={sceneParam}
              onChange={handleSceneParamChange}
            >
              <option value=""></option>
              {sceneLabels.map(({ label, value }) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>{" "}
          </label>
          {sceneParam}
        </div>
        <div>
          <label htmlFor="colorInput">color</label>
          <input
            id="colorInput"
            type="color"
            value={dotColor}
            onChange={handleColorChange}
          />{" "}
          {dotColor}
        </div>
        <div>
          <label htmlFor="backgroundColorInput">background Color</label>
          <input
            id="backgroundColorInput"
            type="color"
            value={backgroundColor}
            onChange={handleBackgroundColorChange}
          />{" "}
          {backgroundColor}
        </div>
      </div>
    </div>
  );
};

export default App;
