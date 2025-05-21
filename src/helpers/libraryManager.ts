// Caches Python files which have been fetched from libraries
type ModuleResult = string | number; // Either the content, or number of HTTP code when we asked
type FilePath = string;
type ModuleCache = Map<FilePath, ModuleResult>;
type LibraryAddress = string;
type LibraryCache = Map<LibraryAddress, ModuleCache>;

// This is (deliberately) only cleared on page reload.  We don't hold it in the store,
// in order to allow this refreshing:
const libraryCache: LibraryCache = new Map();
// Keys are user/repo/branch
const githubCache = new Map<string, string[]>();

async function getGithubRepoPaths(
    user: string,
    repo: string,
    branch: string,
    token?: string // optional GitHub token
): Promise<string[]> {
    const key = `${user}/${repo}/${branch}`;
    if (githubCache.has(key)) {
        return githubCache.get(key) as string[];
    }
    
    const headers: Record<string, string> = {
        "Accept": "application/vnd.github.v3+json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Step 1: Get the commit SHA for the branch
    const branchRes = await fetch(
        `https://api.github.com/repos/${user}/${repo}/branches/${branch}`,
        { headers }
    );
    if (!branchRes.ok) {
        throw new Error(`Failed to get branch info: ${branchRes.status}`);
    }
    const branchData = await branchRes.json();
    const treeSha = branchData.commit.commit.tree.sha;

    // Step 2: Fetch the full recursive tree
    const treeRes = await fetch(
        `https://api.github.com/repos/${user}/${repo}/git/trees/${treeSha}?recursive=1`,
        { headers }
    );
    if (!treeRes.ok) {
        throw new Error(`Failed to get tree: ${treeRes.status}`);
    }
    const treeData = await treeRes.json();

    // Step 3: Extract file paths
    const result = treeData.tree
        .filter((entry: any) => entry.type === "blob") // only files
        .map((entry: any) => entry.path);
    githubCache.set(key, result);
    return result;
}


async function attemptFetchModule(address: LibraryAddress, fileName: FilePath) : Promise<ModuleResult> {
    // Convert Github URLs to our Github protocol:
    address = address.replace(/^https?:\/\/(www\.?)github.com\//, "github:");
    // Remove leading ./:
    fileName = fileName.replace(/^\.\//, "");
    
    let url;
    if (address.startsWith("https:") || address.startsWith("http:")) {
        url = new URL(fileName, address + (address.endsWith("/") ? "" : "/"));
    }
    else if (address.startsWith("github:")) {
        // Addresses are either user/repo, or user/repo/branch.
        const components = address.slice("github:".length).split("/");
        if (components.length == 2) {
            // We assume branch name is main:
            components.push("main");
        }
        if (components.length != 3) {
            return 404;
        }
        // Check if file is in Github tree (involves less requests than trying each file manually,
        // since Skulpt looks for about 15 files per module import:
        const paths = await getGithubRepoPaths(components[0], components[1], components[2]);
        
        if (!paths.includes(fileName)) {
            return 404;
        }
        
        url = new URL(`${components[0]}/${components[1]}/${components[2]}/${fileName}`, "https://raw.githubusercontent.com/");
    }
    else {
        // Unknown protocol, fail:
        return 400;
    }
    
    const response = await fetch(url);
    if (response.ok) {
        return await response.text();
    }
    else {
        return response.status;
    }
}

// Uses the cache if at all possible.
// All parameters are assumed to be already trimmed.
export async function getFileFromLibraries(libraryAddresses: LibraryAddress[], filePath: FilePath): Promise<string | null> {
    if (libraryAddresses.length === 0) {
        return null;
    }

    const [currentAddress, ...rest] = libraryAddresses;

    // Get or create the module cache for the current address
    let moduleCache = libraryCache.get(currentAddress);
    if (!moduleCache) {
        moduleCache = new Map();
        libraryCache.set(currentAddress, moduleCache);
    }

    // Check if result is already cached
    if (moduleCache.has(filePath)) {
        const result = moduleCache.get(filePath);
        if (typeof result == "string") {
            return result; // Found a non-null cached result
        }
        // Else, it's a known failure — skip to next address
    }
    else {
        // Not cached yet — attempt fetch
        const result = await attemptFetchModule(currentAddress, filePath);
        moduleCache.set(filePath, result); // Cache result (even if fails)

        if (typeof result == "string") {
            return result;
        }
    }

    // Recurse into the rest of the addresses
    return getFileFromLibraries(rest, filePath);
}
