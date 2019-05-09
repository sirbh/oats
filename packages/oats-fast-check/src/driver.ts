import * as fs from "fs";
import * as yaml from "js-yaml";
import * as types from "./generate-types";
import * as server from "./generate-server";
import * as path from "path";
import * as oas from "openapi3-ts";

function modulePath(importer: string, module: string | undefined) {
  if (!module) {
    return "@smartlyio/oats";
  }
  let p = path.relative(path.dirname(importer), path.dirname(module));
  if (p[0] !== ".") {
    p = "./" + p;
  }
  if (p[p.length - 1] !== "/") {
    p = p + "/";
  }
  p = p + path.basename(module, ".ts");
  return p;
}

export interface Driver {
  openapiFilePath: string;
  generatedValueClassFile: string;
  header: string;
  generatedServerFile?: string;
  generatedClientFile?: string;
  runtimeFilePath?: string; // set path to runtime directly for testing
  emitStatusCode?: (statusCode: number) => boolean;
}

function emitAllStatusCodes() {
  return true;
}
export function generate(driver: Driver) {
  const file = fs.readFileSync(driver.openapiFilePath, "utf8");
  const spec: oas.OpenAPIObject = yaml.load(file);
  fs.writeFileSync(
    driver.generatedValueClassFile,
    driver.header +
      "\n" +
      types.run({
        oas: spec,
        runtimeModule: modulePath(
          driver.generatedValueClassFile,
          driver.runtimeFilePath
        ),
        emitStatusCode: driver.emitStatusCode || emitAllStatusCodes
      })
  );

  if (driver.generatedClientFile) {
    fs.writeFileSync(
      driver.generatedClientFile,
      server.run({
        oas: spec,
        runtimePath: modulePath(
          driver.generatedClientFile,
          driver.runtimeFilePath
        ),
        typePath: modulePath(
          driver.generatedClientFile,
          driver.generatedValueClassFile
        ),
        shapesAsResponses: false,
        shapesAsRequests: true
      })
    );
  }
  if (driver.generatedServerFile) {
    fs.writeFileSync(
      driver.generatedServerFile,
      server.run({
        oas: spec,
        runtimePath: modulePath(
          driver.generatedServerFile,
          driver.runtimeFilePath
        ),
        typePath: modulePath(
          driver.generatedServerFile,
          driver.generatedValueClassFile
        ),
        shapesAsRequests: false,
        shapesAsResponses: true
      })
    );
  }
}