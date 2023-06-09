async function getPackageJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Failed to fetch');
    }
    const packageJsonData = await response.text();
    const packageJson = JSON.parse(packageJsonData);
    return packageJson;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return null;
  }
}

function allDeps(json) {
  const deps: string[] = [];
  if (json.dependencies) {
    deps.push(...Object.keys(json.dependencies))
  }
  if (json.devDependencies) {
    deps.push(...Object.keys(json.devDependencies))
  }
  if (json.peerDependencies) {
    deps.push(...Object.keys(json.peerDependencies))
  }
  if (json.bundleDependencies) {
    deps.push(...Object.keys(json.bundleDependencies))
  }
  if (json.optionalDependencies) {
    deps.push(...Object.keys(json.optionalDependencies))
  }
  return deps;
}

async function fetcher(packages: string[], levels: number, res = {}, process: NodeJS.Process | null = null) {
  if (!levels) return res;
  for (const packageName of packages) {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache'
    });
    if (process) {
      process.stdout.clearLine(0);
      process.stdout.write("\rAnalyzing package: " + packageName);
    }
    if (response.ok) {
      const data = await response.json();
      const packages = allDeps(data);
      await fetcher(packages, levels-1, res);
      const { funding } = data;
      res[packageName] = funding;
    } else {
      console.error(`Failed to fetch package info for ${packageName}`);
    }
  }
  return res;
}

export async function fetchFundingInfo(json, levels = 1, process: NodeJS.Process | null = null) {
  const packages = allDeps(json);
  const results: Record<string, undefined | string | {type?: string, url?: string} | {type?: string, url?: string}[]> = {};

  if (process) process.stdout.write("Analyzing your package.json...");
  await fetcher(packages, levels, results, process);

  const lnPackages = {};

  for (const [key, value] of Object.entries(results)) {
    if (value && typeof value !== 'string') {
      if (Array.isArray(value)) {
        const lnFunding = value.find((funding) => funding.type === 'lightning');
        if (lnFunding) lnPackages[key] = lnFunding.url;
      } else {
        if (value.type === 'lightning') {
          const lnAddress = value.url
          lnPackages[key] = (lnAddress && lnAddress.startsWith("lightning:")) ? lnAddress.substring(10) : lnAddress;
        }
      }
    }
  }
  return lnPackages;
}

export async function getFundingDetails(path: string = "package.json", levels: number = 1) {
  const json = await getPackageJson(path);
  const packageInfo = await fetchFundingInfo(json, levels);
  return packageInfo;
}
