import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IPrefixDefinition } from "@ducks/workspace/typings";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { Button, SimpleDialog } from "@gui-elements/index";
import PrefixRow from "./PrefixRow";
import DeleteModal from "../../../shared/modals/DeleteModal";
import PrefixNew from "./PrefixNew";
import DataList from "../../../shared/Datalist";
import Loading from "../../../shared/Loading";
import { useTranslation } from "react-i18next";

/** Manages project prefix definitions. */
const PrefixesDialog = ({ onCloseModal, isOpen }) => {
    const dispatch = useDispatch();

    const prefixList = useSelector(workspaceSel.prefixListSelector);
    const configWidget = useSelector(workspaceSel.widgetsSelector).configuration;
    const { isLoading } = configWidget;

    const [isOpenRemove, setIsOpenRemove] = useState<boolean>(false);
    const [selectedPrefix, setSelectedPrefix] = useState<IPrefixDefinition>(null);

    const [t] = useTranslation();

    const toggleRemoveDialog = (prefix?: IPrefixDefinition) => {
        if (!prefix || isOpenRemove) {
            setIsOpenRemove(false);
            setSelectedPrefix(null);
        } else {
            setIsOpenRemove(true);
            setSelectedPrefix(prefix);
        }
    };

    const handleConfirmRemove = () => {
        if (selectedPrefix) {
            dispatch(workspaceOp.fetchRemoveProjectPrefixAsync(selectedPrefix.prefixName));
        }
        toggleRemoveDialog();
    };

    const handleAddOrUpdatePrefix = (prefix: IPrefixDefinition) => {
        const { prefixName, prefixUri } = prefix;
        dispatch(workspaceOp.fetchAddOrUpdatePrefixAsync(prefixName, prefixUri));
    };

    return (
        <SimpleDialog
            title={t("widget.ConfigWidget.prefixTitle", "Manage Prefixes")}
            isOpen={isOpen}
            onClose={onCloseModal}
            actions={<Button onClick={() => onCloseModal()}>{t("common.action.close")}</Button>}
        >
            {isLoading ? (
                <Loading description={t("widget.ConfigWidget.loadingPrefix", "Loading prefix configuration.")} />
            ) : (
                <>
                    <PrefixNew onAdd={(newPrefix: IPrefixDefinition) => handleAddOrUpdatePrefix(newPrefix)} />
                    <DataList isEmpty={!prefixList.length} isLoading={isLoading} hasSpacing hasDivider>
                        {prefixList.map((prefix, i) => (
                            <PrefixRow key={i} prefix={prefix} onRemove={() => toggleRemoveDialog(prefix)} />
                        ))}
                    </DataList>
                </>
            )}
            <DeleteModal
                isOpen={isOpenRemove}
                onDiscard={() => toggleRemoveDialog()}
                onConfirm={handleConfirmRemove}
                title={t("common.action.DeleteSmth", { smth: t("widget.ConfigWidget.prefix") })}
            >
                <p>{t("PrefixDialog.deletePrefix", { prefixName: selectedPrefix ? selectedPrefix.prefixName : "" })}</p>
            </DeleteModal>
        </SimpleDialog>
    );
};

export default PrefixesDialog;
