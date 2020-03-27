import React, { useEffect, useState } from "react";
import PrefixesDialog from "./PrefixesDialog";
import { useDispatch, useSelector } from "react-redux";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { IPrefixState } from "@ducks/workspace/typings";
import {
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Divider,
    OverviewItemList,
    OverviewItem,
    OverviewItemDescription,
    OverviewItemLine,
    OverviewItemActions,
} from '@wrappers/index';

export const ConfigurationWidget = () => {
    const dispatch = useDispatch();
    const prefixList = useSelector(workspaceSel.prefixListSelector);

    const [visiblePrefixes, setVisiblePrefixes] = useState<IPrefixState[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const VISIBLE_COUNT = 5;

    useEffect(() => {
        getPrefixesList();
    }, []);

    useEffect(() => {
        const visibleItems = prefixList.slice(0, VISIBLE_COUNT);
        setVisiblePrefixes(visibleItems);
    }, [prefixList]);

    const getFullSizeOfList = () => Object.keys(prefixList).length;
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    const getPrefixesList = () => {
        dispatch(workspaceOp.fetchProjectPrefixesAsync());
    };

    const moreCount = getFullSizeOfList() - VISIBLE_COUNT;

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Configuration</h3>
                </CardTitle>
            </CardHeader>
            <Divider />
            <CardContent>
                <OverviewItemList hasSpacing hasDivider>
                    <OverviewItem>
                        <OverviewItemDescription>
                            <OverviewItemLine>
                                <strong>Prefixes&nbsp;({(getFullSizeOfList())})</strong>
                            </OverviewItemLine>
                            <OverviewItemLine small>
                                <span>
                                {
                                    visiblePrefixes.map((o, index) =>
                                        <span key={index}>
                                            {o.prefixName}
                                            {
                                                index < visiblePrefixes.length - 1
                                                    ? ', '
                                                    : moreCount > 0 && <>and {moreCount} more</>
                                            }
                                        </span>
                                    )
                                }
                                </span>
                            </OverviewItemLine>
                        </OverviewItemDescription>
                        <OverviewItemActions>
                            <IconButton onClick={handleOpen} name="item-edit" text="Edit prefix settings" />
                        </OverviewItemActions>
                    </OverviewItem>
                </OverviewItemList>
                <PrefixesDialog
                    isOpen={isOpen}
                    onCloseModal={handleClose}
                />
            </CardContent>
        </Card>
    )
};
