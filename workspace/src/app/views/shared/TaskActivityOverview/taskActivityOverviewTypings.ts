/** Response object of the response array of an activity list request. */
export interface IActivityListEntry {
    // name / ID of the activity
    name: string;
    // Non-singleton activities may have multiple parallel instances while singleton instances always have one instance.
    instances: { id: string }[];
    // Characteristics of an activity.
    activityCharacteristics: IActivityCharacteristics;
}

/** Characteristics of a specific activity. */
interface IActivityCharacteristics {
    // If this is a main (execution) activity, i.e. it should be preferably shown to the user.
    isMainActivity: boolean;
    // If this is a cached activity, i.e. that it stores cached values (that can become stale) and thus needs to support restarts.
    isCacheActivity: boolean;
}
