import { Panel } from '../components/Panel';
import { Capture } from '../components/Capture';
import { Focus } from '../components/Focus';
import { Inbox } from '../components/Inbox';

export function QueueView() {
  return (
    <>
      <Panel delay={60}>
        <Capture />
      </Panel>
      <Panel delay={120}>
        <Focus />
      </Panel>
      <Panel delay={180}>
        <Inbox />
      </Panel>
    </>
  );
}
