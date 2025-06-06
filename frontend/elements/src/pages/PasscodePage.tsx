import { Fragment } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "preact/compat";
import { State } from "@teamhanko/hanko-frontend-sdk";

import { AppContext } from "../contexts/AppProvider";
import { TranslateContext } from "@denysvuika/preact-translate";

import Button from "../components/form/Button";
import Content from "../components/wrapper/Content";
import Form from "../components/form/Form";
import Footer from "../components/wrapper/Footer";
import CodeInput from "../components/form/CodeInput";
import ErrorBox from "../components/error/ErrorBox";
import Paragraph from "../components/paragraph/Paragraph";
import Headline1 from "../components/headline/Headline1";
import Link from "../components/link/Link";
import { useFlowState } from "../hooks/UseFlowState";

interface Props {
  state: State<"passcode_confirmation">;
}

const PasscodePage = (props: Props) => {
  const numberOfDigits = 6;
  const { t } = useContext(TranslateContext);
  const { flowState } = useFlowState(props.state);
  const { uiState, setUIState } = useContext(AppContext);
  const [ttl, setTtl] = useState<number>();
  const [resendAfter, setResendAfter] = useState<number>(
    flowState.payload.resend_after,
  );
  const [passcodeDigits, setPasscodeDigits] = useState<string[]>([]);

  const maxAttemptsReached = useMemo(
    () => flowState.error?.code === "passcode_max_attempts_reached",
    [flowState],
  );

  const submitPasscode = useCallback(
    async (code: string) => {
      return await flowState.actions.verify_passcode.run({ code });
    },
    [flowState],
  );

  const onPasscodeInput = (digits: string[]) => {
    setPasscodeDigits(digits);
    // Automatically submit the Passcode when every input contains a digit.
    if (digits.filter((digit) => digit !== "").length === numberOfDigits) {
      return submitPasscode(digits.join(""));
    }
  };

  const onPasscodeSubmit = async (event: Event) => {
    event.preventDefault();
    return submitPasscode(passcodeDigits.join(""));
  };

  useEffect(() => {
    const timer = ttl > 0 && setInterval(() => setTtl(ttl - 1), 1000);
    return () => clearInterval(timer);
  }, [ttl]);

  useEffect(() => {
    const timer =
      resendAfter > 0 &&
      setInterval(() => {
        setResendAfter(resendAfter - 1);
      }, 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);

  useEffect(() => {
    if (resendAfter == 0 && flowState.error?.code == "rate_limit_exceeded") {
      setUIState((prev) => ({ ...prev, error: null }));
    }
  }, [resendAfter]);

  useEffect(() => {
    setPasscodeDigits([]);
    if (flowState.payload.resend_after >= 0) {
      setResendAfter(flowState.payload.resend_after);
    }
  }, [flowState]);

  return (
    <Fragment>
      <Content>
        <Headline1>{t(`headlines.loginPasscode`)}</Headline1>
        <ErrorBox state={flowState} />
        <Paragraph>
          {uiState.email
            ? t("texts.enterPasscode", { emailAddress: uiState.email })
            : t("texts.enterPasscodeNoEmail")}
        </Paragraph>
        <Form
          flowAction={flowState.actions.verify_passcode}
          onSubmit={onPasscodeSubmit}
        >
          <CodeInput
            onInput={onPasscodeInput}
            passcodeDigits={passcodeDigits}
            numberOfInputs={numberOfDigits}
            disabled={ttl <= 0 || maxAttemptsReached}
          />
          <Button disabled={ttl <= 0 || maxAttemptsReached}>
            {t("labels.continue")}
          </Button>
        </Form>
      </Content>
      <Footer>
        <Link
          flowAction={flowState.actions.back}
          loadingSpinnerPosition={"right"}
        >
          {t("labels.back")}
        </Link>
        <Link
          disabled={resendAfter > 0}
          flowAction={flowState.actions.resend_passcode}
          loadingSpinnerPosition={"left"}
        >
          {resendAfter > 0
            ? t("labels.passcodeResendAfter", {
                passcodeResendAfter: resendAfter,
              })
            : t("labels.sendNewPasscode")}
        </Link>
      </Footer>
    </Fragment>
  );
};

export default PasscodePage;
