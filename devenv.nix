{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # https://devenv.sh/basics/
  packages = [ pkgs.git pkgs.opentofu pkgs.gitleaks ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm.enable = true;
  };
  languages.typescript.enable = true;

  # https://devenv.sh/processes/
  processes.dev.exec = "pnpm dev";

  # https://devenv.sh/tests/
  enterTest = ''
    pnpm test
  '';
}
