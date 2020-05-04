import React, { useEffect, useState } from "react";
import { IRelatedItem, IRelatedItems } from "@ducks/shared/thunks/relatedItems.thunk";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    ContextMenu,
    Divider,
    MenuDivider,
    MenuItem,
    OverviewItem,
    OverviewItemActions,
    OverviewItemDescription,
    OverviewItemLine,
} from "@wrappers/index";
import { sharedOp } from "@ducks/shared";
import DataList from "../Datalist";
import { RelatedItemsSearch } from "./RelatedItemsSearch";
import Tag from "@wrappers/src/components/Tag/Tag";
import { getItemLinkIcons } from "../../../utils/getItemLinkIcons";
import Spacing from "@wrappers/src/components/Separation/Spacing";
import { Highlighter } from "../Highlighter/Highlighter";
import Pagination from "@wrappers/src/components/Pagination/Pagination";

/** Project ID and task ID of the project task */
interface IRelatedItemsParams {
    projectId: string;
    taskId: string;
}

/** Widget that shows related items of project tasks
 *
 * @param projectId The project ID of the project task.
 * @param taskId The task ID of the project task.
 */
export function RelatedItems({ projectId, taskId }: IRelatedItemsParams) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ total: 0, items: [] } as IRelatedItems);
    const [textQuery, setTextQuery] = useState("");
    const [pagination, setPagination] = useState({ total: 0, current: 1, limit: 5 });

    useEffect(() => {
        getRelatedItemsData(projectId, taskId, textQuery);
    }, [taskId, projectId, textQuery]);

    // Fetches and updates the related items of the project task
    const getRelatedItemsData = async (projectId: string, taskId: string, textQuery: string) => {
        setLoading(true);
        const data = await sharedOp.getRelatedItemsAsync(projectId, taskId, textQuery);
        if (data.items) {
            setPagination({ total: data.total, current: pagination.current, limit: pagination.limit });
            setData(data);
        }
        setLoading(false);
    };

    // Postfix for the title showing the filtered number and total number of related items.
    const relatedItemsSizeInfo = (length: number, total: number) => {
        if (total > 0) {
            if (length === total) {
                return ` (${total})`; // Don't repeat if they are the same
            } else {
                return ` (${length} / ${total})`;
            }
        } else {
            return ""; // Don't show anything if there is no related item at all.
        }
    };

    const searchFired = (searchInput: string) => {
        setTextQuery(searchInput);
    };

    const pageSizes = [2, 3, 5, 10, 20];

    const onChangeSelect = ({ page, pageSize }) => {
        setPagination({ total: pagination.total, current: page, limit: pageSize });
    };
    console.log(pagination);
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Related Items{relatedItemsSizeInfo(data.items.length, data.total)}</h3>
                </CardTitle>
            </CardHeader>
            <Divider />
            <CardContent>
                {data.total > 0 || textQuery !== "" ? <RelatedItemsSearch onSearch={searchFired} /> : false}
                <Spacing size="small" />
                <DataList
                    isEmpty={data.items.length === 0}
                    isLoading={loading}
                    emptyListMessage={"No items found"}
                    hasSpacing
                    hasDivider
                >
                    {data.items
                        .slice((pagination.current - 1) * pagination.limit, pagination.current * pagination.limit)
                        .map((relatedItem: IRelatedItem) => {
                            const contextMenuItems = relatedItem.itemLinks.map((link) => (
                                <MenuItem
                                    key={link.path}
                                    text={link.label}
                                    href={link.path}
                                    icon={getItemLinkIcons(link.label)}
                                />
                            ));
                            return (
                                <OverviewItem key={relatedItem.id} densityHigh>
                                    <OverviewItemDescription>
                                        <OverviewItemLine>
                                            <span>
                                                <Tag>
                                                    <Highlighter label={relatedItem.type} searchValue={textQuery} />
                                                </Tag>{" "}
                                                <Highlighter label={relatedItem.label} searchValue={textQuery} />
                                            </span>
                                        </OverviewItemLine>
                                    </OverviewItemDescription>
                                    <OverviewItemActions>
                                        <ContextMenu togglerText="Show more options">
                                            {contextMenuItems.length ? (
                                                <>
                                                    <MenuDivider />
                                                    {contextMenuItems}
                                                </>
                                            ) : null}
                                        </ContextMenu>
                                    </OverviewItemActions>
                                </OverviewItem>
                            );
                        })}
                </DataList>
                <Spacing size="small" />
                {data.items.length > Math.min(pagination.total, 5) ? ( // Don't show if no pagination is needed
                    <Pagination
                        onChange={onChangeSelect}
                        totalItems={pagination.total}
                        pageSizes={pageSizes}
                        page={pagination.current}
                        pageSize={pagination.limit}
                    />
                ) : null}
            </CardContent>
        </Card>
    );
}
