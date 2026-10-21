{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # https://devenv.sh/basics/
  packages = [
    pkgs.git
    pkgs.opentofu
    pkgs.gitleaks
    pkgs.zizmor
    pkgs.actionlint
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm.enable = true;
  };
  languages.typescript.enable = true;

  # https://devenv.sh/processes/
  processes.dev.exec = "pnpm dev";

  # https://devenv.sh/git-hooks/
  git-hooks.hooks.gitleaks = {
    enable = true;
    name = "gitleaks";
    # gitleaks shells out to git, and hooks can run with a minimal PATH, so put git on it explicitly.
    entry = toString (
      pkgs.writeShellScript "gitleaks-staged" ''
        export PATH="${pkgs.git}/bin:$PATH"
        exec ${pkgs.gitleaks}/bin/gitleaks git --staged --redact --no-banner
      ''
    );
    language = "system";
    pass_filenames = false;
  };

  # https://devenv.sh/tests/
  enterTest = ''
    pnpm test
  '';
}
