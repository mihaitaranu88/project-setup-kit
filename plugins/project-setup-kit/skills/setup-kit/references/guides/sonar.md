# Guide: SonarCloud / SonarQube (item 23)

## SonarCloud (hosted; free for public repos, paid per lines of code for private)

1. (user) Sign in at sonarcloud.io with GitHub, import the organization and the repository.
2. (user) In the project: Administration → Analysis Method → turn off "Automatic Analysis" (CI analysis is needed for coverage).
3. (user) My Account → Security → generate a token. Save it as secret `SONAR_TOKEN` (`gh secret set SONAR_TOKEN`).
4. Write `sonar-project.properties` with the project key and organization shown in SonarCloud, the source/test folders and the coverage report path for each language. Set `{{SONAR_HOST_URL}}` to `https://sonarcloud.io`.
5. Make the test step produce coverage: Jest/Vitest `--coverage` (lcov), pytest `--cov --cov-report=xml`, PHPUnit `--coverage-clover`, Go `-coverprofile=coverage.out`.
6. Write `.github/workflows/sonar.yml`.
7. (user) In SonarCloud: Quality Gates → use "Sonar way" (80% coverage on new code, ≤3% duplication) or adjust the threshold the user chose.
8. Phase 4: mark the "SonarCloud Code Analysis" check as required.

## SonarQube self-hosted (Community Build is free)

Same steps, but the user provides the server URL (`SONAR_HOST_URL` as a repository variable or secret) and creates the project and token on that server. Community Build does not analyze pull requests separately (branch analysis needs a paid edition); say this before the user chooses it.

## Without Sonar

Offer the two sub-items: `coverage.yml` (diff-cover on changed lines, threshold chosen by the user) and `duplication.yml` (jscpd warning).
