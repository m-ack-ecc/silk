import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { routerOp } from "@ducks/router";
import { IItemLink } from "@ducks/shared/typings";
import { commonSel } from "@ducks/common";
import { requestItemLinks } from "@ducks/shared/requests";
import { IExportTypes } from "@ducks/common/typings";
import { downloadProject } from "../../../utils/downloadProject";
import { DATA_TYPES } from "../../../constants";
import { ItemDeleteModal } from "../modals/ItemDeleteModal";
import CloneModal from "../modals/CloneModal";
import { IframeWindow } from "../IframeWindow/IframeWindow";
import { ActionsMenu, TActionsMenuItem, IActionsMenuProps } from "./ActionsMenu";
import CopyToModal from "../modals/CopyToModal/CopyToModal";

interface IProps {
    projectId: string;
    taskId?: string;
    itemType: string;
    updateActionsMenu: (actionMenu: JSX.Element) => any;
    // Called with true when the item links endpoint returns a 404
    notFoundCallback?: (boolean) => any;
}

export function ArtefactManagementOptions({
    projectId,
    taskId,
    itemType,
    updateActionsMenu,
    notFoundCallback = () => {},
}: IProps) {
    const dispatch = useDispatch();
    const location = useLocation<any>();
    const [t] = useTranslation();
    const [displayItemLink, setDisplayItemLink] = useState<IItemLink | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [copyToModalOpen, setCopyToModalOpen] = useState<boolean>(false);
    const [itemLinks, setItemLinks] = useState<IItemLink[]>([]);
    const [menuItems, setMenuItems] = useState<IActionsMenuProps>({});
    const exportTypes = useSelector(commonSel.exportTypesSelector);

    const itemData = {
        id: taskId ? taskId : undefined,
        projectId: projectId ? projectId : undefined,
        type: itemType ? itemType : undefined,
    };

    // Update item links for more menu
    useEffect(() => {
        if (projectId && taskId) {
            getItemLinks();
        } else {
            setItemLinks([]);
        }
    }, [projectId, taskId]);

    const getItemLinks = async () => {
        try {
            const { data } = await requestItemLinks(projectId, taskId);
            // remove current page link
            const result = data.filter((item) => item.path !== location.pathname);
            setItemLinks(result);
            notFoundCallback(false);
        } catch (e) {
            if (e?.httpStatus === 404) {
                notFoundCallback(true);
            }
        }
    };

    const handleDeleteConfirm = () => {
        toggleDeleteModal();
        let afterPage = "";
        if (taskId) {
            afterPage = `projects/${projectId}`;
        }
        dispatch(routerOp.goToPage(afterPage));
    };

    const handleCloneConfirmed = (id, detailsPage) => {
        toggleCloneModal();
        dispatch(routerOp.goToPage(detailsPage));
    };

    const handleProjectExport = (type: IExportTypes) => {
        downloadProject(itemData.projectId, type.id);
    };

    const handleCopyConfirmed = () => {
        toggleCopyToModal();
    };

    // handler for link change
    const toggleItemLink = (linkItem: IItemLink | null = null) => {
        setDisplayItemLink(linkItem);
    };

    const toggleDeleteModal = () => {
        setDeleteModalOpen(!deleteModalOpen);
    };

    const toggleCloneModal = () => {
        setCloneModalOpen(!cloneModalOpen);
    };

    const toggleCopyToModal = () => {
        setCopyToModalOpen(!copyToModalOpen);
    };

    const getFullMenu = () => {
        const fullMenu: TActionsMenuItem[] = [
            {
                text: t("common.action.copy", "Copy to"),
                actionHandler: toggleCopyToModal,
                "data-test-id": "header-copy-button",
            },
            {
                text: t("common.action.clone", "Clone"),
                actionHandler: toggleCloneModal,
                "data-test-id": "header-clone-button",
            },
        ];

        if (itemType === DATA_TYPES.PROJECT && !!exportTypes.length) {
            const subitems = [];
            exportTypes.forEach((type) => {
                subitems.push({
                    text: type.label,
                    actionHandler: () => handleProjectExport(type),
                });
            });

            fullMenu.push({
                text: t("common.action.exportTo", "Export to"),
                subitems: subitems,
            });
        }

        if (itemLinks && itemLinks.length > 0) {
            itemLinks.forEach((itemLink) => {
                fullMenu.push({
                    text: t("common.legacyGui." + itemLink.label, itemLink.label),
                    actionHandler: () => toggleItemLink(itemLink),
                });
            });
        }

        return fullMenu;
    };

    useEffect(() => {
        setMenuItems({
            actionsSecondary:
                projectId || taskId
                    ? [
                          {
                              text: t("common.action.RemoveSmth", {
                                  smth: taskId
                                      ? t("common.dataTypes.task", "Task")
                                      : t("common.dataTypes.project", "Project"),
                              }),
                              icon: "item-remove",
                              actionHandler: toggleDeleteModal,
                              disruptive: true,
                              "data-test-id": "header-remove-button",
                          },
                      ]
                    : [],
            actionsFullMenu: projectId || taskId ? getFullMenu() : [],
        });
    }, [projectId, taskId, itemType, exportTypes, itemLinks]);

    useEffect(() => {
        updateActionsMenu(<ActionsMenu {...menuItems} />);
    }, [menuItems]);

    return (
        <>
            {deleteModalOpen && (
                <ItemDeleteModal item={itemData} onClose={toggleDeleteModal} onConfirmed={handleDeleteConfirm} />
            )}

            {cloneModalOpen && (
                <CloneModal item={itemData} onDiscard={toggleCloneModal} onConfirmed={handleCloneConfirmed} />
            )}

            {copyToModalOpen && (
                <CopyToModal item={itemData} onDiscard={toggleCopyToModal} onConfirmed={handleCopyConfirmed} />
            )}
            {displayItemLink && (
                <IframeWindow
                    srcLinks={itemLinks}
                    startWithLink={displayItemLink}
                    startFullscreen={true}
                    handlerRemoveModal={() => toggleItemLink(null)}
                />
            )}
        </>
    );
}
