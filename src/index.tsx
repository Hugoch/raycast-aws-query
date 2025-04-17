import {
  List,
  ActionPanel,
  Action,
  Detail,
  environment,
  Icon,
} from "@raycast/api";
import { useSQL } from "@raycast/utils";
import { useState, useMemo } from "react";
import path from "path";
import fs from "fs";
import { instanceStoreIOPS } from "./instanceStoreIOPS";

// --- Interfaces ---

// Interface for the basic instance info derived from the query result
interface BaseInstanceInfo {
  instanceType: string;
  vCpus: number;
  memorySizeInGiB: number; // Calculated from MiB
  storageInGB: string; // Updated to string to handle "EBS only"
  networkPerformance: string;
  onDemandLinuxHr?: number | null; // Sample hourly price (can be null)
  disks?: DiskInfo[]; // Array of disk information
}

// Interface for disk information
interface DiskInfo {
  count: number;
  sizeInGB: number;
  type: string;
  iops?: { randomRead: number; write: number }; // IOPS for the disk
  estimatedSpeed?: { readSpeed: string; writeSpeed: string }; // Estimated speeds based on IOPS
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

// Type for the structure returned by the disks SQL query
type DiskQueryResult = {
  instanceType: string;
  count: number;
  sizeInGB: number;
  type: string;
};

// --- Database Path ---
// Construct the path to the database file only once
const dbPath = path.join(environment.assetsPath, "data.db");
const dbExists = fs.existsSync(dbPath); // Check existence once

// --- Helper Functions ---

// Format price helper (remains the same)
const formatPrice = (
  price: number | undefined | null,
  precision = 4,
): string => {
  if (price === undefined || price === null || isNaN(price)) {
    return "N/A";
  }
  if (price === 0) return "$0.00";
  return `$${price.toFixed(precision)}`;
};

// Estimate disk speeds based on IOPS and block size
const estimateDiskSpeed = (
  iops?: { randomRead: number; write: number },
  type?: string,
) => {
  if (!iops) return undefined;

  // Define block size based on documentation
  const blockSize = 4; // 4,096 bytes = 4 KB

  const readSpeed = `${((iops.randomRead * blockSize) / 1024).toFixed(2)} MiB/s`;
  const writeSpeed = `${((iops.write * blockSize) / 1024).toFixed(2)} MiB/s`;

  return { readSpeed, writeSpeed };
};

// --- React Components ---

// Main Raycast Command Component
export default function Command() {
  const [searchText, setSearchText] = useState("");

  // SQL query to fetch the initial list of instances
  const instanceListQuery = useMemo(
    () => `
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
  `,
    [],
  );

  // Use the useSQL hook to fetch the main instance list
  // The hook manages loading and error states for us.
  // It only runs if the database file exists.
  const {
    data: rawInstanceData,
    isLoading: isLoadingList,
    error: listError,
  } = useSQL<InstanceListQueryResult>(dbPath, instanceListQuery, {
    // Execute hook only if DB exists, otherwise error handled below
    execute: dbExists,
  });

  // SQL query to fetch disk information for all instances
  const diskQuery = useMemo(
    () => `
      SELECT
          d.instanceType,
          d.count,
          d.sizeInGB,
          d.type
      FROM
          "instance-disks" d;
    `,
    [],
  );

  // Use the useSQL hook to fetch disk information
  const { data: rawDiskData } = useSQL<DiskQueryResult>(dbPath, diskQuery, {
    execute: dbExists,
  });

  // Process the raw data returned by useSQL
  const instances = useMemo((): BaseInstanceInfo[] => {
    if (!rawInstanceData) {
      return [];
    }

    // Group disk data by instanceType
    const diskDataByInstanceType =
      rawDiskData?.reduce(
        (acc, disk) => {
          if (!acc[disk.instanceType]) {
            acc[disk.instanceType] = [];
          }
          acc[disk.instanceType].push({
            count: disk.count,
            sizeInGB: disk.sizeInGB,
            type: disk.type,
            iops: instanceStoreIOPS[disk.instanceType], // Fetch IOPS data
            estimatedSpeed: estimateDiskSpeed(
              instanceStoreIOPS[disk.instanceType],
              disk.type,
            ), // Estimate speeds
          });
          return acc;
        },
        {} as Record<string, DiskInfo[]>,
      ) || {};

    // Map results to the BaseInstanceInfo interface, converting MiB to GiB
    return rawInstanceData.map((row) => {
      const disks = diskDataByInstanceType[row.instanceType] || [];
      const totalStorageInGB = disks.reduce(
        (sum, disk) => sum + disk.count * disk.sizeInGB,
        0,
      );

      return {
        instanceType: row.instanceType,
        vCpus: row.vCpus,
        memorySizeInGiB: row.memorySizeInMiB
          ? parseFloat((row.memorySizeInMiB / 1024).toFixed(2))
          : 0, // Calculate GiB
        storageInGB:
          totalStorageInGB > 0 ? `${totalStorageInGB} GB` : "EBS only", // Show "EBS only" if no storage
        networkPerformance: row.networkPerformance,
        onDemandLinuxHr: row.onDemandLinuxHr, // Already fetched as potentially null
        disks: disks, // Attach disk info
      };
    });
  }, [rawInstanceData, rawDiskData]); // Recalculate only when rawInstanceData or rawDiskData changes

  // Filter instances based on search text
  const filteredInstances = useMemo(() => {
    if (!searchText) return instances;
    const lowerCaseSearchText = searchText.toLowerCase();
    return instances.filter((instance) =>
      instance.instanceType.toLowerCase().includes(lowerCaseSearchText),
    );
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
      isShowingDetail={
        filteredInstances.length > 0 && !isLoadingList && !displayError
      }
    >
      {displayError && (
        <List.EmptyView
          title="Error Loading Data"
          description={displayError}
          icon={Icon.Warning}
        />
      )}
      {!isLoadingList && !displayError && filteredInstances.length === 0 && (
        <List.EmptyView
          title={searchText ? "No Instances Found" : "No Data"}
          description={
            searchText
              ? `Could not find instances matching "${searchText}".`
              : "Instance data is empty or could not be loaded from DB."
          }
          icon={Icon.MagnifyingGlass}
        />
      )}
      {filteredInstances.map((instance) => (
        <List.Item
          key={instance.instanceType}
          title={instance.instanceType}
          subtitle={`${instance.vCpus} vCPU | ${instance.memorySizeInGiB} GiB RAM | ${instance.storageInGB}`}
          accessories={[
            { tag: formatPrice(instance.onDemandLinuxHr, 4) + "/hr" },
          ]}
          // Pass base info to Detail view
          detail={
            <List.Item.Detail
              markdown={`# ${instance.instanceType}\n\n* **vCPUs**: ${instance.vCpus}\n\n* **Memory**: ${instance.memorySizeInGiB} GiB\n\n* **Storage**: ${instance.storageInGB}\n\n* **Network**: ${instance.networkPerformance}\n\n* **Disks**:\n${
                instance.disks?.length > 0
                  ? instance.disks
                      .map(
                        (disk) =>
                          `  - ${disk.count} x ${disk.sizeInGB} GB (${disk.type})${
                            disk.iops
                              ? `\n  - Random Read IOPS: ${disk.iops.randomRead} (${disk.estimatedSpeed?.readSpeed})\n  - Write IOPS: ${disk.iops.write} (${disk.estimatedSpeed?.writeSpeed})`
                              : ""
                          }`,
                      )
                      .join("\n")
                  : "  - No disk information available."
              }`}
            />
          }
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Details"
                target={<InstanceDetailView baseInfo={instance} />}
              />
              <Action.CopyToClipboard
                title="Copy Instance Type"
                content={instance.instanceType}
              />
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
  const regionQuery = useMemo(
    () => `
      SELECT DISTINCT
          p.location as location
      FROM
          "instance-shared-prices" p
      WHERE
          p.instanceType = '${baseInfo.instanceType}'
      ORDER BY
          p.location;
  `,
    [],
  );

  // Use useSQL hook to fetch regions, passing the instanceType as an argument
  const {
    data: regionData,
    isLoading: isLoadingRegions,
    error: regionError,
  } = useSQL<RegionQueryResult>(dbPath, regionQuery, {
    execute: dbExists, // Only run if DB exists
  });

  // Extract region names from the query result
  const regions = useMemo(() => {
    return regionData?.map((row) => row.location) ?? [];
  }, [regionData]);

  // Construct the Markdown content for the detail view
  const markdown = `
# ${baseInfo.instanceType}

## Specifications
* **vCPUs:** ${baseInfo.vCpus}
* **Memory:** ${baseInfo.memorySizeInGiB} GiB
* **Storage:** ${baseInfo.storageInGB}
* **Network:** ${baseInfo.networkPerformance}

## Disks
${
  baseInfo.disks && baseInfo.disks.length > 0
    ? baseInfo.disks
        .map(
          (disk) =>
            `* ${disk.count} x ${disk.sizeInGB} GB (${disk.type})${
              disk.iops
                ? `\n* Random Read IOPS: ${disk.iops.randomRead} (${disk.estimatedSpeed?.readSpeed})\n* Write IOPS: ${disk.iops.write} (${disk.estimatedSpeed?.writeSpeed})`
                : ""
            }`,
        )
        .join("\n")
    : "*No disk information available.*"
}

## On-Demand Linux Pricing (Sample)
* **Hourly:** ${formatPrice(baseInfo.onDemandLinuxHr, 4)}
    *_(This is a sample price, often the minimum found across regions. Actual price depends on the specific region.)_*

## Available Regions (${isLoadingRegions ? "Loading..." : regionError ? "Error" : (regions?.length ?? "0")})
${
  isLoadingRegions
    ? "*Loading region data...*"
    : regionError
      ? `*Error loading regions: ${regionError.message}*`
      : regions && regions.length > 0
        ? regions.map((region) => `* ${region}`).join("\n")
        : "*No specific region data found*"
}
  `;

  return (
    <Detail
      isLoading={isLoadingRegions && dbExists} // Show loading indicator while fetching regions (if DB exists)
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Instance Type"
            text={baseInfo.instanceType}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="vCPUs" text={String(baseInfo.vCpus)} />
          <Detail.Metadata.Label
            title="Memory (GiB)"
            text={String(baseInfo.memorySizeInGiB)}
          />
          <Detail.Metadata.Label
            title="Storage (GB)"
            text={baseInfo.storageInGB}
          />
          <Detail.Metadata.Label
            title="Network Performance"
            text={baseInfo.networkPerformance}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Pricing (Sample On-Demand Linux)">
            <Detail.Metadata.TagList.Item
              text={`Hourly: ${formatPrice(baseInfo.onDemandLinuxHr, 4)}`}
              color={"#eed535"}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Region Count"
            text={
              isLoadingRegions
                ? "Loading..."
                : regionError
                  ? "Error"
                  : String(regions?.length ?? "N/A")
            }
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Disks"
            text={
              baseInfo.disks && baseInfo.disks.length > 0
                ? baseInfo.disks
                    .map((disk) => {
                      return `${disk.count} x ${disk.sizeInGB} GB (${disk.type})`;
                    })
                    .join(", ")
                : "No disk information available."
            }
          />
        </Detail.Metadata>
      }
    />
  );
}
