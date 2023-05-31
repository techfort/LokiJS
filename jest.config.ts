import type { JestConfigWithTsJest } from "ts-jest";
import { defaults as tsjPreset } from "ts-jest/presets";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  verbose: true,
  transform: {
    ...tsjPreset.transform,
  },
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/build/",
    "<rootDir>/spec/browser/",
  ],
};

export default jestConfig;
