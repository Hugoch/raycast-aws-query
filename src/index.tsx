import { List, ActionPanel, Action, Detail, environment, Icon } from "@raycast/api";
import { useSQL } from "@raycast/utils"; // Import the hook
import { useState, useMemo } from "react";
import path from "path";
import fs from "fs"; // Still needed for checking if DB file exists

// --- Interfaces ---

// Interface for the basic instance info derived from the query result
interface BaseInstanceInfo {
    instanceType: string;
    vCpus: number;
    memorySizeInGiB: number; // Calculated from MiB
    storage: string;
    networkPerformance: string;
    onDemandLinuxHr?: number | null; // Sample hourly price (can be null)
}

// Type for the structure returned directly by the main list SQL query
type InstanceListQueryResult = {
    instanceType: string;
    vCpus: number;
    memorySizeInMiB: number; // Fetched as MiB from DB
    storage: string;
    networkPerformance: string;
    onDemandLinuxHr: number | null; // MIN returns null if no matching rows in LEFT JOIN
};

// Type for the structure returned by the region SQL query
type RegionQueryResult = {
    location: string[];
};

// --- Database Path ---

// Construct the path to the database file only once
const dbPath = path.join(environment.assetsPath, "data.db");
const dbExists = fs.existsSync(dbPath); // Check existence once

// --- Helper Functions ---

// Format price helper (remains the same)
const formatPrice = (price: number | undefined | null, precision = 4): string => {
    if (price === undefined || price === null || isNaN(price)) {
        return "N/A";
    }
    if (price === 0) return "$0.00";
    return `$${price.toFixed(precision)}`;
};

// --- React Components ---

// Main Raycast Command Component
export default function Command() {
    const [searchText, setSearchText] = useState("");

    // SQL query to fetch the initial list of instances
    const instanceListQuery = useMemo(() => `
      SELECT
          t.instanceType,
          t.vCpus,
          t.memorySizeInMiB,
          t.storage,
          t.networkPerformance,
          MIN(p.onDemandLinuxHr) as onDemandLinuxHr
      FROM
          "instance-types" t
      LEFT JOIN
          "instance-shared-prices" p ON t.instanceType = p.instanceType
      GROUP BY
          t.instanceType
      ORDER BY
          t.instanceType;
  `, []);

    // Use the useSQL hook to fetch the main instance list
    // The hook manages loading and error states for us.
    // It only runs if the database file exists.
    const { data: rawInstanceData, isLoading: isLoadingList, error: listError } = useSQL<InstanceListQueryResult>(
        dbPath,
        instanceListQuery,
        {
            // Execute hook only if DB exists, otherwise error handled below
            execute: dbExists,
        }
    );

    // Process the raw data returned by useSQL
    const instances = useMemo((): BaseInstanceInfo[] => {
        if (!rawInstanceData) {
            return [];
        }
        // Map results to the BaseInstanceInfo interface, converting MiB to GiB
        return rawInstanceData.map(row => ({
            instanceType: row.instanceType,
            vCpus: row.vCpus,
            memorySizeInGiB: row.memorySizeInMiB ? parseFloat((row.memorySizeInMiB / 1024).toFixed(2)) : 0, // Calculate GiB
            storage: row.storage,
            networkPerformance: row.networkPerformance,
            onDemandLinuxHr: row.onDemandLinuxHr, // Already fetched as potentially null
        }));
    }, [rawInstanceData]); // Recalculate only when rawInstanceData changes

    // Filter instances based on search text
    const filteredInstances = useMemo(() => {
        if (!searchText) return instances;
        const lowerCaseSearchText = searchText.toLowerCase();
        return instances.filter((instance) => instance.instanceType.toLowerCase().includes(lowerCaseSearchText));
    }, [instances, searchText]);

    // Determine the overall error state
    const displayError = !dbExists
        ? `Database file not found. Please ensure 'data.db' is in the assets folder: ${environment.assetsPath}`
        : listError?.message;

    return (
        <List
            isLoading={isLoadingList && dbExists} // Only show loading if DB exists and query is running
            searchBarPlaceholder="Search AWS Instance Types (e.g., t2.micro, m5.large)"
            onSearchTextChange={setSearchText}
            isShowingDetail={filteredInstances.length > 0 && !isLoadingList && !displayError}
        >
            {displayError && <List.EmptyView title="Error Loading Data" description={displayError} icon={Icon.Warning} />}
            {!isLoadingList && !displayError && filteredInstances.length === 0 && (
                <List.EmptyView
                    title={searchText ? "No Instances Found" : "No Data"}
                    description={searchText ? `Could not find instances matching "${searchText}".` : "Instance data is empty or could not be loaded from DB."}
                    icon={Icon.MagnifyingGlass}
                />
            )}
            {filteredInstances.map((instance) => (
                <List.Item
                    key={instance.instanceType}
                    title={instance.instanceType}
                    subtitle={`${instance.vCpus} vCPU | ${instance.memorySizeInGiB} GiB RAM | ${instance.storage}`}
                    accessories={[
                        { tag: formatPrice(instance.onDemandLinuxHr, 4) + "/hr" },
                    ]}
                    // Pass base info to Detail view
                    detail={<List.Item.Detail markdown={`# ${instance.instanceType}\n\n* **vCPUs**: ${instance.vCpus}\n\n* **Memory**: ${instance.memorySizeInGiB} GiB\n\n* **Storage**: ${instance.storage}\n\n* **Network**: ${instance.networkPerformance}`}/>}
                    actions={
                        <ActionPanel>
                            <Action.Push title="Show Details" target={<InstanceDetailView baseInfo={instance} />} />
                            <Action.CopyToClipboard title="Copy Instance Type" content={instance.instanceType} />
                        </ActionPanel>
                    }
                />
            ))}
        </List>
    );
}

// --- Detail View Component ---

function InstanceDetailView({ baseInfo }: { baseInfo: BaseInstanceInfo }) {

    // SQL query to fetch regions for the selected instance type
    const regionQuery = useMemo(() => `
      SELECT DISTINCT
          p.location as location
      FROM
          "instance-shared-prices" p
      WHERE
          p.instanceType = '${baseInfo.instanceType}'
      ORDER BY
          p.location;
  `, []);

    // Use useSQL hook to fetch regions, passing the instanceType as an argument
    const { data: regionData, isLoading: isLoadingRegions, error: regionError } = useSQL<RegionQueryResult>(
        dbPath,
        regionQuery,
        {
            execute: dbExists, // Only run if DB exists
        }
    );

    // Extract region names from the query result
    const regions = useMemo(() => {
        return regionData?.map(row => row.location) ?? [];
    }, [regionData]);

    // Construct the Markdown content for the detail view
    const markdown = `
# ${baseInfo.instanceType}

## Specifications
* **vCPUs:** ${baseInfo.vCpus}
* **Memory:** ${baseInfo.memorySizeInGiB} GiB
* **Storage:** ${baseInfo.storage}
* **Network:** ${baseInfo.networkPerformance}

## On-Demand Linux Pricing (Sample)
* **Hourly:** ${formatPrice(baseInfo.onDemandLinuxHr, 4)}
    *_(This is a sample price, often the minimum found across regions. Actual price depends on the specific region.)_*

## Available Regions (${isLoadingRegions ? 'Loading...' : regionError ? 'Error' : regions?.length ?? '0'})
${isLoadingRegions
        ? '*Loading region data...*'
        : regionError
            ? `*Error loading regions: ${regionError.message}*`
            : regions && regions.length > 0
                ? regions.map((region) => `* ${region}`).join("\n")
                : '*No specific region data found*'
    }
  `;

    return (
        <Detail
            isLoading={isLoadingRegions && dbExists} // Show loading indicator while fetching regions (if DB exists)
            markdown={markdown}
            metadata={
                <Detail.Metadata>
                    <Detail.Metadata.Label title="Instance Type" text={baseInfo.instanceType} />
                    <Detail.Metadata.Separator />
                    <Detail.Metadata.Label title="vCPUs" text={String(baseInfo.vCpus)} />
                    <Detail.Metadata.Label title="Memory (GiB)" text={String(baseInfo.memorySizeInGiB)} />
                    <Detail.Metadata.Label title="Storage" text={baseInfo.storage} />
                    <Detail.Metadata.Label title="Network Performance" text={baseInfo.networkPerformance} />
                    <Detail.Metadata.Separator />
                    <Detail.Metadata.TagList title="Pricing (Sample On-Demand Linux)">
                        <Detail.Metadata.TagList.Item text={`Hourly: ${formatPrice(baseInfo.onDemandLinuxHr, 4)}`} color={"#eed535"} />
                    </Detail.Metadata.TagList>
                    <Detail.Metadata.Separator />
                    <Detail.Metadata.Label title="Region Count" text={isLoadingRegions ? "Loading..." : regionError ? "Error" : String(regions?.length ?? 'N/A')} />
                </Detail.Metadata>
            }
        />
    );
}
