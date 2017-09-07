import * as React from "react";
import formStyles from "./FormCell.module.scss";
import { IFormCellProps } from "./IFormCellProps";
import { escape } from "@microsoft/sp-lodash-subset";
import { SPHttpClient, SPHttpClientResponse } from "@microsoft/sp-http";
import { Modal } from "office-ui-fabric-react/lib/Modal";
import { IPropertyPaneDropdownOption } from "@microsoft/sp-webpart-base";
import { Environment, EnvironmentType } from "@microsoft/sp-core-library";
import MockHttpClient from "../MockHttpClient";
import DynamicInput from "./DynamicInput";
import {
  PrimaryButton,
  TextField,
  Dropdown,
  Callout,
  IDropdownOption
} from "office-ui-fabric-react/lib";

export interface ISPField {
  Title: string;
  InternalName: string;
  TypeAsString?: string;
  Choices?: string[];
}

export interface ISPFields {
  value: ISPField[];
}

export default class FormCell extends React.Component<IFormCellProps> {
  private _cellElement: HTMLElement;
  private _fieldOptions: any[] = [];
  private _fields: ISPField[] = [];

  constructor(props) {
    super(props);
    /* Check which environment the app is in */
    if (Environment.type === EnvironmentType.Local) {
      //Local Env
      this.getMockFieldData().then(response => {
        this._fieldOptions = response.value.map((field: ISPField) => {
          return {
            key: field.InternalName,
            text: field.Title
          };
        });

        this._fields = response.value.map((field: ISPField) => {
          return {
            Title: field.Title,
            InternalName: field.InternalName,
            TypeAsString: field.Title,
            Choices: field.Choices
          };
        });
      });
    } else if (
      //SharePoint Env
      Environment.type == EnvironmentType.SharePoint ||
      Environment.type == EnvironmentType.ClassicSharePoint
    ) {
      this.fetchOptions().then(response => {
        this._fieldOptions = response;
      });
    }
  }

  private getMockFieldData(): Promise<ISPFields> {
    return MockHttpClient.getSPFields().then((data: ISPField[]) => {
      var fieldData: ISPFields = { value: data };
      return fieldData;
    }) as Promise<ISPFields>;
  }

  private fetchOptions(): Promise<object[]> {
    var url =
      this.props.context.pageContext.web.absoluteUrl +
      "/_api/web/lists/getbytitle('" +
      this.props.listName +
      "')/fields?$filter=Hidden eq false";

    return this.fetchListFields(url).then(response => {
      var options: Array<object> = new Array<object>();
      response.value.map(field => {
        options.push({ key: field.InternalName, text: field.Title });

        this._fields.push({
          Title: field.Title,
          InternalName: field.InternalName,
          TypeAsString: field.TypeAsString,
          Choices: field.Choices ? field.Choices : null
        });
      });

      return options;
    });
  }

  private fetchListFields(url: string): Promise<any> {
    return this.props.context.spHttpClient
      .get(url, SPHttpClient.configurations.v1)
      .then((response: SPHttpClientResponse) => {
        if (response.ok) {
          return response.json();
        } else {
          console.log(
            "WARNING - failed to hit URL " +
              url +
              ". Error = " +
              response.statusText
          );
          return null;
        }
      });
  }

  private showModal(e) {
    var targetElem = e.target;
    var divElem =
      targetElem.type === "submit"
        ? targetElem.parentElement
        : targetElem.parentElement.parentElement;

    this.props.cellObj.showModal = true;
    this.props.cellObj.elemToBeReplaced = divElem ? divElem : null;
    this.props.onChange(this.props.cellObj);
  }

  private closeModal() {
    this.props.cellObj.showModal = false;
    this.props.onChange(this.props.cellObj);
  }

  private handleModalSubmit() {
    var elemToBeReplaced = this.props.cellObj.elemToBeReplaced;
    var labelValue: string = this.props.cellObj.lblValue;
    var fieldInternalName: string = this.props.cellObj.fieldKeySelected;

    if (this.props.cellObj.showLblInput && elemToBeReplaced && labelValue) {
      this.props.cellObj.hasInputType = true;
      this.props.cellObj.dynamicInputType = "label";
    } else if (
      this.props.cellObj.showListFieldInput &&
      elemToBeReplaced &&
      fieldInternalName
    ) {
      this.props.cellObj.hasInputType = true;

      switch (this.props.cellObj.spoFieldType.toLowerCase()) {
        case "text":
          this.props.cellObj.dynamicInputType = "textfield";
          break;
        case "choice":
          this.props.cellObj.dynamicInputType = "dropdown";
          break;
        default:
          this.props.cellObj.dynamicInputType = "textfield";
      }
    }

    this.props.cellObj.showModal = false;
    this.props.cellObj.isSubmitted = true;
    this.props.onChange(this.props.cellObj);
  }

  private handleElemTypeChange(e): void {
    var keyVal: string = e.key;
    this.props.cellObj.elemTypeKeySelected = keyVal;

    if (keyVal === "lbl") {
      this.props.cellObj.showLblInput = true;
      this.props.cellObj.showListFieldInput = false;
    } else if (keyVal === "fieldInput") {
      this.props.cellObj.showLblInput = false;
      this.props.cellObj.showListFieldInput = true;
    }
    this.props.onChange(this.props.cellObj);
  }

  private handleFieldChange(e): void {
    var internalName: string = e.key;
    this.props.cellObj.fieldKeySelected = internalName;

    var selectedFieldObject: object = this._fields.filter(obj => {
      return obj.InternalName === internalName;
    });
    this.props.cellObj.spoFieldType = selectedFieldObject[0].TypeAsString;
    this.props.cellObj.optionsArray = selectedFieldObject[0].Choices
      ? selectedFieldObject[0].Choices
      : null;
    this.props.onChange(this.props.cellObj);
  }

  private handleLblValChange(text): void {
    this.props.cellObj.lblValue = text;
    this.props.onChange(this.props.cellObj);
  }

  private handlelistFieldValChange(text): void {
    this.props.cellObj.listFieldValue = text;
    this.props.onChange(this.props.cellObj);
  }

  private onMouseOverCell(): void {
    if (this.props.cellObj.isSubmitted && this.props.isEditable) {
      this.props.cellObj.showCallout = true;
      this.props.onChange(this.props.cellObj);
    }
  }

  private onCalloutDismiss(): void {
    this.props.cellObj.showCallout = false;
    this.props.onChange(this.props.cellObj);
  }

  private handleCalloutEdit(): void {
    this.props.cellObj.showModal = true;
    this.props.onChange(this.props.cellObj);
  }

  public render(): React.ReactElement<IFormCellProps> {
    const labelInput = this.props.cellObj.showLblInput ? (
      <TextField
        className={formStyles.modalInput}
        label="Label Text"
        value={this.props.cellObj.lblValue}
        onChanged={this.handleLblValChange.bind(this)}
      />
    ) : null;

    const listFieldInput = this.props.cellObj.showListFieldInput ? (
      <Dropdown
        className={formStyles.modalInput}
        options={this._fieldOptions}
        onChanged={this.handleFieldChange.bind(this)}
        selectedKey={this.props.cellObj.fieldKeySelected}
      />
    ) : null;

    return (
      <div
        className={formStyles.formCell}
        onMouseOver={() => this.onMouseOverCell()}
        ref={cell => (this._cellElement = cell)}
      >
        {this.props.cellObj.hasInputType ? (
          <DynamicInput
            type={this.props.cellObj.dynamicInputType}
            optionsArray={this.props.cellObj.optionsArray}
            lblValue={this.props.cellObj.lblValue}
          />
        ) : (
          <div>
            <PrimaryButton
              onClick={this.showModal.bind(this)}
              className={formStyles.newCellBtn}
            >
              <p className={formStyles.label}>+</p>
            </PrimaryButton>
          </div>
        )}

        {this.props.cellObj.showCallout && (
          <Callout
            className={formStyles.calloutContainer}
            ariaLabelledBy={"callout-label-1"}
            ariaDescribedBy={"callout-description-1"}
            role={"alertdialog"}
            gapSpace={0}
            target={this._cellElement}
            onDismiss={this.onCalloutDismiss.bind(this)}
            setInitialFocus={true}
          >
            <div className={formStyles.calloutHeader}>
              <p className={formStyles.calloutTitle} id={"callout-label-1"}>
                Update
              </p>
            </div>
            <div className={formStyles.calloutInner}>
              <div>
                <p
                  className={formStyles.calloutSubtext}
                  id={"callout-description-1"}
                >
                  You can change the contents of this component by clicking the
                  button below.
                </p>
              </div>
              <div className={formStyles.calloutActions}>
                <PrimaryButton onClick={this.handleCalloutEdit.bind(this)}>
                  <p className={formStyles.label}>Edit</p>
                </PrimaryButton>
              </div>
            </div>
          </Callout>
        )}

        <Modal
          isOpen={this.props.cellObj.showModal}
          onDismiss={this.closeModal.bind(this)}
          isBlocking={false}
          containerClassName={formStyles.modalContainer}
        >
          <div className={formStyles.modalHeader}>
            <span>Create Form Element</span>
          </div>
          <div>
            <p className={formStyles.modalMargin}>
              Choose the type of form element:
            </p>
            <Dropdown
              className={formStyles.modalInput}
              options={[
                { key: "lbl", text: "Label" },
                { key: "fieldInput", text: "List Field Input" }
              ]}
              onChanged={this.handleElemTypeChange.bind(this)}
              selectedKey={this.props.cellObj.elemTypeKeySelected}
            />

            {labelInput}
            {listFieldInput}

            <div>
              <PrimaryButton
                className={formStyles.modalMargin}
                onClick={this.handleModalSubmit.bind(this)}
              >
                <p className={formStyles.label}>Submit</p>
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}
